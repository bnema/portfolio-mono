package models

type Commit struct {
	ID        string `json:"id"`
	RepoName  string `json:"repo_name"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
	URL       string `json:"url"`
	IsPrivate bool   `json:"is_private"`
}
