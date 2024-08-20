package services

import (
	"errors"
	"log"
	"portfolio-mono/models"
	"sync"
	"time"
)

type CommitCache struct {
	commits     []models.Commit
	lastUpdated time.Time
	mutex       sync.RWMutex
}

func StartCacheUpdateScheduler() {
	// Initial load of all commits
	if err := UpdateCommitCache(); err != nil {
		log.Printf("Error initializing commit cache: %v", err)
	}

	// Schedule periodic updates
	ticker := time.NewTicker(5 * time.Minute)
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

// GetAllCommitsFromCache returns a paginated list of commits from the cache
func GetAllCommitsFromCache(page, limit int) ([]models.Commit, int, error) {
	cache.mutex.RLock()
	defer cache.mutex.RUnlock()

	if time.Since(cache.lastUpdated) > 15*time.Minute {
		// Cache is stale, update it asynchronously
		go func() {
			if err := UpdateCommitCache(); err != nil {
				errors.New("Error updating commit cache")
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

// UpdateCommitCache fetches recent commits and updates the cache
func UpdateCommitCache() error {
	log.Println("Updating commit cache...")
	cache.mutex.RLock()
	lastUpdate := cache.lastUpdated
	isEmpty := len(cache.commits) == 0
	cache.mutex.RUnlock()

	var recentCommits []models.Commit
	var err error

	if isEmpty {
		// If cache is empty, fetch all commits
		log.Println("Cache is empty, fetching all commits...")
		recentCommits, err = FetchAllCommitsFromAllRepos()
	} else {
		// Otherwise, just get recent commits
		log.Printf("Fetching commits since %s...\n", lastUpdate.Format(time.RFC3339))
		recentCommits, err = FetchRecentCommits(lastUpdate)
	}

	if err != nil {
		errors.New("Error fetching commits")
		return err
	}

	log.Printf("Fetched %d commits\n", len(recentCommits))

	cache.mutex.Lock()
	defer cache.mutex.Unlock()

	if isEmpty {
		cache.commits = recentCommits
	} else {
		cache.commits = append(recentCommits, cache.commits...)
	}

	cache.lastUpdated = time.Now()
	log.Printf("Cache update completed. Total commits: %d\n", len(cache.commits))
	return nil
}
