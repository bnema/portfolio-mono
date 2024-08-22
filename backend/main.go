package main

import (
	"context"
	"os"
	"os/signal"
	"portfolio-backend/api"
	"portfolio-backend/config"
	"portfolio-backend/services"
	"sync"
	"syscall"
	"time"

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

	// Create a WaitGroup to manage background tasks
	var wg sync.WaitGroup

	// Start cache update scheduler in the background
	wg.Add(1)
	go func() {
		defer wg.Done()
		services.StartCacheUpdateScheduler()
	}()

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

	// Start server in a goroutine
	go func() {
		if err := e.Start(cfg.Port); err != nil {
			e.Logger.Info("Shutting down the server")
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	// Shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		e.Logger.Fatal(err)
	}

	// Wait for background tasks to complete
	wg.Wait()
}
