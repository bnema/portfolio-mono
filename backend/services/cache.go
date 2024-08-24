package services

import (
	"portfolio-backend/models"
	"sort"
	"sync"
	"time"

	"github.com/charmbracelet/log"
)

type CommitCache struct {
	commits     map[string]models.Commit
	lastUpdated time.Time
	mutex       sync.RWMutex
}

var cache = &CommitCache{
	commits: make(map[string]models.Commit),
}

func StartCacheUpdateScheduler() {
	// Initial load of all commits
	if err := UpdateCommitCache(); err != nil {
		log.Error("Error initializing commit cache:" + err.Error())
	}

	// Schedule periodic updates
	go func() {
		ticker := time.NewTicker(15 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			if err := UpdateCommitCache(); err != nil {
				log.Error("Error updating commit cache:" + err.Error())
			}
		}
	}()
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

	totalCount := len(commits)
	startIndex := (page - 1) * limit
	endIndex := startIndex + limit

	if startIndex >= totalCount {
		return []models.Commit{}, totalCount, nil
	}

	if endIndex > totalCount {
		endIndex = totalCount
	}

	return commits[startIndex:endIndex], totalCount, nil
}

func UpdateCommitCache() error {
	log.Info("Updating commit cache...")

	recentCommits, err := FetchRecentCommits(cache.lastUpdated)
	if err != nil {
		log.Error("Error fetching commits" + err.Error())
		return err
	}

	log.Info("Fetching commits...")

	cache.mutex.Lock()
	defer cache.mutex.Unlock()

	for _, commit := range recentCommits {
		cache.commits[commit.ID] = commit
	}

	cache.lastUpdated = time.Now()
	log.Info("Cache update completed.")
	return nil
}
