package main

import (
	"net/http"
	"os"
	"strings"

	"github.com/charmbracelet/log"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

type Post struct {
	ID      int    `json:"id"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

func main() {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	e := echo.New()
	e.HideBanner = true

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	//
	allowedOrigins := strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",")
	if len(allowedOrigins) == 0 {
		log.Fatal("ALLOWED_ORIGINS is required in .env file")
	}

	// CORS
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     allowedOrigins,
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowCredentials: true,
	}))

	// Public routes
	e.GET("/health", func(c echo.Context) error {
		return c.String(http.StatusOK, "OK")
	})

	// Grouped routes that require JWT
	r := e.Group("/api")

	// Protected routes
	r.GET("/posts", getPosts)

	// Start server
	port := ":5432"
	e.Logger.Fatal(e.Start(port))
}

func getPosts(c echo.Context) error {
	posts := []Post{
		{ID: 1, Title: "Lorem Ipsum 1", Content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit."},
		{ID: 2, Title: "Lorem Ipsum 2", Content: "Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas."},
		{ID: 3, Title: "Lorem Ipsum 3", Content: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."},
		{ID: 4, Title: "Lorem Ipsum 4", Content: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur."},
	}

	return c.JSON(http.StatusOK, posts)
}
