package services

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"portfolio-backend/models"

	"github.com/google/go-github/v63/github"
	"github.com/migueleliasweb/go-github-mock/src/mock"
)

func TestUpdateCommitCache(t *testing.T) {
	// Set up mock data
	now := time.Now()
	mockCommits := []*github.CommitResult{
		{
			SHA: github.String("new-commit-id"),
			Commit: &github.Commit{
				Message: github.String("Test commit"),
				Author: &github.CommitAuthor{
					Date: &github.Timestamp{Time: now},
				},
			},
			HTMLURL: github.String("https://github.com/test/test-repo/commit/new-commit-id"),
			Repository: &github.Repository{
				Name:    github.String("test-repo"),
				Private: github.Bool(false),
			},
		},
	}

	// Create mocked HTTP client
	mockedHTTPClient := mock.NewMockedHTTPClient(
		mock.WithRequestMatch(
			mock.GetUsersByUsername,
			github.User{Login: github.String("testuser")},
		),
		mock.WithRequestMatch(
			mock.GetUser,
			github.User{Login: github.String("testuser")},
		),
		mock.WithRequestMatchHandler(
			mock.GetSearchCommits,
			http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				query := r.URL.Query().Get("q")
				if !strings.Contains(query, "author:testuser") {
					http.Error(w, "Unexpected query", http.StatusBadRequest)
					return
				}
				json.NewEncoder(w).Encode(github.CommitsSearchResult{
					Commits: mockCommits,
				})
			}),
		),
	)

	// Override the GitHub client
	originalClient := githubClient
	githubClient = github.NewClient(mockedHTTPClient)
	defer func() { githubClient = originalClient }()

	// Initialize cache with some old commits
	cache = &CommitCache{
		commits: map[string]models.Commit{
			"old-commit-id": {
				ID:        "old-commit-id",
				RepoName:  "test-repo",
				Message:   "Old commit",
				Timestamp: now.Add(-1 * time.Hour).Format(time.RFC3339),
				URL:       "https://github.com/test/test-repo/commit/old-commit-id",
				IsPrivate: false,
			},
		},
	}

	// Set the lastUpdated time using the atomic.Value Store method
	cache.lastUpdated.Store(now.Add(-30 * time.Minute))

	// Run the update
	err := UpdateCommitCache()
	if err != nil {
		t.Fatalf("UpdateCommitCache returned an error: %v", err)
	}

	// Check if the new commit was added
	if len(cache.commits) != 2 {
		t.Errorf("Expected 2 commits in cache, got %d", len(cache.commits))
	}

	newestCommit, ok := cache.commits["new-commit-id"]
	if !ok {
		t.Errorf("Expected to find 'new-commit-id' in cache, but it was not present")
	} else if newestCommit.ID != "new-commit-id" {
		t.Errorf("Expected newest commit to be 'new-commit-id', got %s", newestCommit.ID)
	}
}
