package api

import (
	"go-api-commits/services"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

func SetupRoutes(e *echo.Echo) {
	e.GET("/health", healthCheck)
	api := e.Group("/api")
	api.GET("/commits", getCommits)
}

func healthCheck(c echo.Context) error {
	return c.String(http.StatusOK, "OK")
}

func getCommits(c echo.Context) error {
	// Get page and limit from query parameters
	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))

	// Set default values if not provided
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20 // Default limit
	}

	commits, totalCount, err := services.GetAllCommitsFromCache(page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	response := map[string]interface{}{
		"commits":     commits,
		"page":        page,
		"limit":       limit,
		"total_count": totalCount,
	}

	return c.JSON(http.StatusOK, response)
}
