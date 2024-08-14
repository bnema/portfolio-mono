package config

import (
	"errors"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	AllowedOrigins []string
	Port           string
	GitHubToken    string
}

func Load() (*Config, error) {
	err := godotenv.Load()
	if err != nil {
		return nil, err
	}

	allowedOrigins := strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",")
	if len(allowedOrigins) == 0 {
		return nil, errors.New("ALLOWED_ORIGINS is required in .env file")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = ":5432"
	}

	githubToken := os.Getenv("GITHUB_TOKEN")
	if githubToken == "" {
		return nil, errors.New("GITHUB_TOKEN is required in .env file")
	}

	return &Config{
		AllowedOrigins: allowedOrigins,
		Port:           port,
		GitHubToken:    githubToken,
	}, nil
}
