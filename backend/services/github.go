package services

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"math/rand"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"portfolio-backend/config"
	"portfolio-backend/models"

	"github.com/charmbracelet/log"
	"github.com/google/go-github/v63/github"
	"golang.org/x/oauth2"
)

var (
	rng     *rand.Rand
	rngOnce sync.Once
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
	release, _, err := client.Repositories.GetLatestRelease(ctx, "bnema", "portfolio-monorepo")
	if err != nil {
		// return the error from the GitHub API
		return fmt.Sprintf("error: %s", err)
	}

	// Extract the version from the release tag name
	version := release.GetTagName()
	if version == "" {
		return "v0.0"
	}

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
			log.Warn(fmt.Sprintf("failed to fetch commits from repository: %s", err))
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

	// Increase timeout to 2 minutes for larger repositories
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
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

	// Convert lastUpdated to UTC for consistent comparison
	lastUpdatedUTC := lastUpdated.UTC()

	// Implement exponential backoff
	backoff := time.Second
	for i := 0; i < 3; i++ { // Try up to 3 times
		result, resp, err := client.Search.Commits(ctx, query, opts)
		if err != nil {
			// Check if the error is due to rate limiting
			if _, ok := err.(*github.RateLimitError); ok {
				time.Sleep(backoff)
				backoff *= 2
				continue
			}
			return nil, fmt.Errorf("failed to search commits: %w", err)
		}

		for _, commit := range result.Commits {
			commitDate := commit.GetCommit().GetAuthor().GetDate()
			commitTimeStamp := commitDate.Time

			if commitTimeStamp.Before(lastUpdatedUTC) || commitTimeStamp.Equal(lastUpdatedUTC) {
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

// FetchProjectsContent fetches all project content from the GitHub repository
func FetchProjectsContent() ([]models.Project, error) {
	client := GetGitHubClient()
	if client == nil {
		return nil, errors.New("GitHub client is not initialized")
	}
	ctx := context.Background()

	owner := "bnema"
	repo := "portfolio-mono"
	path := "content/projects"

	var projects []models.Project

	opts := &github.RepositoryContentGetOptions{}
	_, directoryContents, _, err := client.Repositories.GetContents(ctx, owner, repo, path, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch directory contents: %w", err)
	}

	for _, file := range directoryContents {
		if filepath.Ext(file.GetName()) != ".md" {
			continue
		}

		fileContent, _, _, err := client.Repositories.GetContents(ctx, owner, repo, file.GetPath(), opts)
		if err != nil {
			return nil, fmt.Errorf("failed to fetch file content for %s: %w", file.GetName(), err)
		}

		content, err := base64.StdEncoding.DecodeString(*fileContent.Content)
		if err != nil {
			return nil, fmt.Errorf("failed to decode content for %s: %w", file.GetName(), err)
		}

		contentStr := string(content)
		projectOrigin := ""
		lines := strings.Split(contentStr, "\n")
		if len(lines) > 0 && strings.HasPrefix(lines[0], "[project_origin]:") {
			projectOrigin = strings.TrimSpace(strings.TrimPrefix(lines[0], "[project_origin]:"))
			contentStr = strings.Join(lines[1:], "\n")
		}

		title := strings.TrimSuffix(file.GetName(), filepath.Ext(file.GetName()))
		slug := strings.ToLower(strings.ReplaceAll(title, " ", "-"))

		projects = append(projects, models.Project{
			Title:         title,
			Slug:          slug,
			ProjectOrigin: projectOrigin,
			Content:       contentStr,
		})
	}

	return projects, nil
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
