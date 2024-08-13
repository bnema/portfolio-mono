package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	echojwt "github.com/labstack/echo-jwt/v4"
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

	secret := os.Getenv("SECRET")
	if secret == "" {
		log.Fatal("SECRET is required in .env file")
	}

	// Generate JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"exp": time.Now().Add(time.Hour * 72).Unix(),
	})

	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		log.Fatalf("Error generating JWT token: %v", err)
	}

	// Output the generated JWT token
	fmt.Printf("JWT token: %s", tokenString)
	// new line
	fmt.Println()

	e := echo.New()
	e.HideBanner = true

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	// CORS
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{"http://localhost:4173"},
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

	// Apply JWT middleware only to this group
	r.Use(echojwt.WithConfig(echojwt.Config{
		SigningKey: []byte(secret),
	}))

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
