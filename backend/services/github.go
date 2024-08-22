package services

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"

	"portfolio-mono/config"
	"portfolio-mono/models"

	"github.com/google/go-github/v63/github"
	"golang.org/x/oauth2"
)

var (
	rng     *rand.Rand
	rngOnce sync.Once
	cache   CommitCache
)

var githubClient *github.Client

// InitGitHubClient initializes the GitHub client
func InitGitHubClient(cfg *config.Config) {
	ctx := context.Background()
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: cfg.GitHubToken},
	)
	tc := oauth2.NewClient(ctx, ts)
	githubClient = github.NewClient(tc)
}

func GetGitHubClient() *github.Client {
	return githubClient
}

func getRNG() *rand.Rand {
	rngOnce.Do(func() {
		rng = rand.New(rand.NewSource(time.Now().UnixNano()))
	})
	return rng
}

// GetVersionFromTag returns the current version of the application fril the latest tag in the repository
func GetVersionFromTag() string {
	client := GetGitHubClient()
	if client == nil {
		return "unknown"
	}

	ctx := context.Background()

	// Get the latest release
	release, _, err := client.Repositories.GetLatestRelease(ctx, "bnema", "portfolio-mono")
	if err != nil {
		return "unknown"
	}

	// Extract the version from the release tag name
	version := release.GetTagName()
	if version == "" {
		return "unknown"
	}

	// Remove 'v' prefix if present
	version = strings.TrimPrefix(version, "v")

	return version
}

// FetchAllCommitsFromAllRepos fetches all commits from all repositories
func FetchAllCommitsFromAllRepos() ([]models.Commit, error) {
	client := GetGitHubClient()
	if client == nil {
		return nil, errors.New("GitHub client is not initialized")
	}
	ctx := context.Background()

	// List all repositories for the authenticated user
	var allRepos []*github.Repository
	opts := &github.RepositoryListByAuthenticatedUserOptions{
		ListOptions: github.ListOptions{PerPage: 100},
		Type:        "owner", // Include both public and private repositories
	}
	for {
		repos, resp, err := client.Repositories.ListByAuthenticatedUser(ctx, opts)
		if err != nil {
			return nil, err
		}
		allRepos = append(allRepos, repos...)
		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	// Now fetch commits from all repositories
	var allCommits []models.Commit
	for _, repo := range allRepos {
		commits, err := fetchCommitsFromRepo(ctx, client, repo.GetOwner().GetLogin(), repo.GetName(), repo.GetPrivate())
		if err != nil {
			errors.New("Error fetching commits from repo: " + repo.GetName())
			continue
		}
		allCommits = append(allCommits, commits...)
	}

	obfuscatedCommits := ObfuscatePrivateCommits(allCommits)

	// Sort all commits by date (newest first)
	sort.Slice(obfuscatedCommits, func(i, j int) bool {
		timeI, _ := time.Parse(time.RFC3339, obfuscatedCommits[i].Timestamp)
		timeJ, _ := time.Parse(time.RFC3339, obfuscatedCommits[j].Timestamp)
		return timeI.After(timeJ)
	})

	return obfuscatedCommits, nil
}

// fetchCommitsFromRepo fetches all commits from a given repository
func fetchCommitsFromRepo(ctx context.Context, client *github.Client, owner, repo string, isPrivate bool) ([]models.Commit, error) {
	var commits []models.Commit
	opts := &github.CommitsListOptions{
		ListOptions: github.ListOptions{PerPage: 100},
	}
	for {
		commitList, resp, err := client.Repositories.ListCommits(ctx, owner, repo, opts)
		if err != nil {
			return nil, err
		}
		for _, commit := range commitList {
			newCommit := models.Commit{
				ID:        commit.GetSHA(),
				RepoName:  repo,
				Message:   commit.GetCommit().GetMessage(),
				Timestamp: commit.GetCommit().GetAuthor().GetDate().Format(time.RFC3339),
				URL:       commit.GetHTMLURL(),
				IsPrivate: isPrivate,
			}
			commits = append(commits, newCommit)
		}
		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}
	return commits, nil
}

// FetchRecentCommits fetches all commits authored by the authenticated user since the last update
func FetchRecentCommits(lastUpdated time.Time) ([]models.Commit, error) {
	client := GetGitHubClient()
	if client == nil {
		return nil, fmt.Errorf("GitHub client is not initialized")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	user, _, err := client.Users.Get(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("failed to get authenticated user: %w", err)
	}
	username := user.GetLogin()

	query := fmt.Sprintf("author:%s", username)
	opts := &github.SearchOptions{
		Sort:  "author-date",
		Order: "desc",
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
	}

	var allCommits []models.Commit
	for {
		result, resp, err := client.Search.Commits(ctx, query, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to search commits: %w", err)
		}

		for _, commit := range result.Commits {
			commitDate := commit.GetCommit().GetAuthor().GetDate()

			commitTimeStamp := commitDate.Time // Convert GitHub timestamp to time.Time

			if commitTimeStamp.Before(lastUpdated) || commitTimeStamp.Equal(lastUpdated) {
				// We've reached commits older than or equal to the last update, so we're done
				return allCommits, nil
			}

			newCommit := models.Commit{
				ID:        commit.GetSHA(),
				RepoName:  commit.GetRepository().GetName(),
				Message:   commit.GetCommit().GetMessage(),
				Timestamp: commitDate.Format(time.RFC3339),
				URL:       commit.GetHTMLURL(),
				IsPrivate: commit.GetRepository().GetPrivate(),
			}
			allCommits = append(allCommits, newCommit)
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return ObfuscatePrivateCommits(allCommits), nil
}

// ObfuscatePrivateCommits replaces private commit data with obfuscated strings
func ObfuscatePrivateCommits(commits []models.Commit) []models.Commit {
	for i, commit := range commits {
		if commit.IsPrivate {
			commits[i].RepoName = obfuscateString(commit.RepoName)
			commits[i].Message = obfuscateString(commit.Message)
			commits[i].ID = obfuscateString(commit.ID)
			commits[i].URL = "#"
		}
	}
	return commits
}

// obfuscateString replaces all characters in a string with obfuscated characters
func obfuscateString(s string) string {
	obfuscatedChars := []rune("░▒▓█▄▀■□▢▣▤▥▦▧▨▩▆▅█▉▇▊▄▋▌_▍▃▂▁")
	r := getRNG()

	var result strings.Builder
	for _, char := range s {
		if char == ' ' || char == '\n' {
			result.WriteRune(char)
		} else {
			result.WriteRune(obfuscatedChars[r.Intn(len(obfuscatedChars))])
		}
	}
	return result.String()
}
