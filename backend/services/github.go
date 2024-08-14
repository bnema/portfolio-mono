package services

import (
	"context"
	"errors"
	"log"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"time"

	"go-api-commits/config"
	"go-api-commits/models"

	"github.com/google/go-github/v63/github"
	"golang.org/x/oauth2"
)

type CommitCache struct {
	commits     []models.Commit
	lastUpdated time.Time
	mutex       sync.RWMutex
}

var (
	commits []models.Commit
	mutex   sync.Mutex
	rng     *rand.Rand
	rngOnce sync.Once
	cache   CommitCache
)

var githubClient *github.Client

func UpdateCommitCache() error {
	commits, err := GetAllCommitsFromAllRepos()
	if err != nil {
		return err
	}

	cache.mutex.Lock()
	defer cache.mutex.Unlock()

	cache.commits = commits
	cache.lastUpdated = time.Now()
	return nil
}

func StartCacheUpdateScheduler() {
	ticker := time.NewTicker(15 * time.Minute)
	go func() {
		for {
			select {
			case <-ticker.C:
				if err := UpdateCommitCache(); err != nil {
					log.Printf("Error updating commit cache: %v", err)
				}
			}
		}
	}()
}

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
func GetAllCommitsFromCache(page, limit int) ([]models.Commit, int, error) {
	cache.mutex.RLock()
	defer cache.mutex.RUnlock()

	if time.Since(cache.lastUpdated) > 15*time.Minute {
		// Cache is stale, update it asynchronously
		go func() {
			if err := UpdateCommitCache(); err != nil {
				log.Printf("Error updating commit cache: %v", err)
			}
		}()
	}

	totalCount := len(cache.commits)
	startIndex := (page - 1) * limit
	endIndex := startIndex + limit

	if startIndex >= totalCount {
		return []models.Commit{}, totalCount, nil
	}

	if endIndex > totalCount {
		endIndex = totalCount
	}

	return cache.commits[startIndex:endIndex], totalCount, nil

}

func GetAllCommitsFromAllRepos() ([]models.Commit, error) {
	client := GetGitHubClient()
	if client == nil {
		return nil, errors.New("GitHub client is not initialized")
	}
	ctx := context.Background()

	// List all repositories for the authenticated user
	var allRepos []*github.Repository
	opts := &github.RepositoryListByAuthenticatedUserOptions{
		ListOptions: github.ListOptions{PerPage: 100},
		Type:        "all", // Include both public and private repositories
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
			// Log the error but continue with other repos
			log.Printf("Error fetching commits from %s: %v", repo.GetName(), err)
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
