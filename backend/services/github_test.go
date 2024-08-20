package services

import (
	"testing"
	"time"

	"portfolio-mono/models"

	"github.com/google/go-github/v63/github"
	"github.com/migueleliasweb/go-github-mock/src/mock"
)

func TestFetchRecentCommits(t *testing.T) {
	// Set up test data
	testTime := time.Now()
	mockCommits := []*github.CommitResult{
		{
			SHA: github.String("abc123"),
			Commit: &github.Commit{
				Message: github.String("Test commit"),
				Author: &github.CommitAuthor{
					Date: &github.Timestamp{Time: testTime},
				},
			},
			HTMLURL: github.String("https://github.com/bnema/repo/commit/abc123"),
			Repository: &github.Repository{
				Name:    github.String("test-repo"),
				Private: github.Bool(false),
			},
		},
	}

	// Create mocked HTTP client
	mockedHTTPClient := mock.NewMockedHTTPClient(
		mock.WithRequestMatch(
			mock.GetSearchCommits,
			&github.CommitsSearchResult{
				Commits: mockCommits,
			},
		),
	)

	// Override the GitHub client
	originalClient := githubClient
	githubClient = github.NewClient(mockedHTTPClient)
	defer func() { githubClient = originalClient }()

	// Run the test
	since := time.Now().AddDate(0, -1, 0)
	commits, err := FetchRecentCommits(since)

	// Check results
	if err != nil {
		t.Fatalf("FetchRecentCommits returned an error: %v", err)
	}

	if len(commits) != 1 {
		t.Errorf("Expected 1 commit, got %d", len(commits))
	}

	expectedCommit := models.Commit{
		ID:        "abc123",
		RepoName:  "test-repo",
		Message:   "Test commit",
		Timestamp: testTime.Format(time.RFC3339),
		URL:       "https://github.com/bnema/repo/commit/abc123",
		IsPrivate: false,
	}

	if commits[0] != expectedCommit {
		t.Errorf("Expected commit %+v, got %+v", expectedCommit, commits[0])
	}
}
