package main

import (
	"context"
	"net/http"
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
	// Load and validate configuration
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
	e.HidePort = true

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

	// Create a context that will be cancelled on interrupt
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverClosed := make(chan struct{})

	// Start server in a goroutine
	go func() {
		port := cfg.Port
		fullAddr := "http://localhost" + port
		log.Info("Starting server", "address", fullAddr)
		if err := e.Start(port); err != nil {
			if err == http.ErrServerClosed {
				log.Info("Server closed")
			} else {
				log.Error("Error starting server" + err.Error())
			}
		}
		close(serverClosed)
	}()

	// Wait for interrupt signal
	<-ctx.Done()
	log.Warn("Received interrupt, shutting down gracefully")

	// Shutdown with timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := e.Shutdown(shutdownCtx); err != nil {
		log.Error("Error during server shutdown" + err.Error())
	}

	// Wait for background tasks to complete
	wg.Wait()
	log.Info("Server shutdown complete")
}
