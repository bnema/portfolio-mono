package main

import (
	"go-api-commits/api"
	"go-api-commits/config"
	"go-api-commits/services"

	"github.com/charmbracelet/log"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("Error loading configuration", "error", err)
	}

	// Initialize GitHub client
	services.InitGitHubClient(cfg)

	services.UpdateCommitCache() // Initial cache population
	services.StartCacheUpdateScheduler()

	e := echo.New()
	e.HideBanner = true

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	// CORS
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowCredentials: true,
	}))

	// Setup routes
	api.SetupRoutes(e)

	// Start server
	e.Logger.Fatal(e.Start(cfg.Port))
}
