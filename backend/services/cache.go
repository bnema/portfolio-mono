package services

import (
	"fmt"
	"portfolio-backend/models"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/charmbracelet/log"
)

type CommitCache struct {
	commits     map[string]models.Commit
	lastUpdated atomic.Value
	mutex       sync.RWMutex
}

var cache *CommitCache

func init() {
	cache = &CommitCache{
		commits: make(map[string]models.Commit),
	}
	cache.lastUpdated.Store(time.Now().UTC())
}

func (c *CommitCache) Update(newCommits []models.Commit) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	for _, commit := range newCommits {
		c.commits[commit.ID] = commit
	}
	c.lastUpdated.Store(time.Now().UTC())
}

func (c *CommitCache) GetLastUpdated() time.Time {
	if lastUpdateValue := c.lastUpdated.Load(); lastUpdateValue != nil {
		return lastUpdateValue.(time.Time)
	}
	return time.Time{} // Return zero time if not set
}

func (c *CommitCache) GetAllCommits() []models.Commit {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	commits := make([]models.Commit, 0, len(c.commits))
	for _, commit := range c.commits {
		commits = append(commits, commit)
	}
	return commits
}
func GetAllCommitsFromCache(page, limit int) ([]models.Commit, int, error) {
	cache.mutex.RLock()
	defer cache.mutex.RUnlock()

	// Convert map to slice for pagination
	commits := make([]models.Commit, 0, len(cache.commits))
	for _, commit := range cache.commits {
		commits = append(commits, commit)
	}

	// Sort commits by timestamp (newest first)
	sort.Slice(commits, func(i, j int) bool {
		timeI, _ := time.Parse(time.RFC3339, commits[i].Timestamp)
		timeJ, _ := time.Parse(time.RFC3339, commits[j].Timestamp)
		return timeI.After(timeJ)
	})

	// Apply obfuscation to private commits
	obfuscatedCommits := ObfuscatePrivateCommits(commits)

	totalCount := len(obfuscatedCommits)
	startIndex := (page - 1) * limit
	endIndex := startIndex + limit

	if startIndex >= totalCount {
		return []models.Commit{}, totalCount, nil
	}

	if endIndex > totalCount {
		endIndex = totalCount
	}

	return obfuscatedCommits[startIndex:endIndex], totalCount, nil
}

func UpdateCommitCache() error {
	log.Info("Updating commit cache...")

	var lastUpdate time.Time
	if lastUpdateValue := cache.lastUpdated.Load(); lastUpdateValue != nil {
		lastUpdate = lastUpdateValue.(time.Time)
	}

	var recentCommits []models.Commit
	var err error

	if len(cache.commits) == 0 {
		// Cache is empty, fetch all commits
		recentCommits, err = FetchAllCommitsFromAllRepos()
	} else {
		// Cache has data, fetch only recent commits
		recentCommits, err = FetchRecentCommits(lastUpdate)
	}

	if err != nil {
		log.Error("Error fetching commits", "error", err)
		return err
	}

	if len(recentCommits) == 0 {
		log.Info("No new commits to add to cache")
		return nil
	}

	cache.Update(recentCommits)
	log.Info("Cache update completed", "new_commits", len(recentCommits))
	return nil
}

func StartCacheUpdateScheduler() {
	// Debug
	fmt.Println("Starting cache update scheduler...")
	// Initial load of all commits
	if err := UpdateCommitCache(); err != nil {
		log.Error("Error initializing commit cache", "error", err)
	}

	// Schedule periodic updates
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			if err := UpdateCommitCache(); err != nil {
				log.Error("Error updating commit cache", "error", err)
			}
		}
	}()
}
