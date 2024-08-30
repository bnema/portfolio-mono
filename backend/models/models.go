package models

type Commit struct {
	ID        string `json:"id"`
	RepoName  string `json:"repo_name"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
	URL       string `json:"url"`
	IsPrivate bool   `json:"is_private"`
}

type Tweet struct {
	ID           string `json:"id"`
	UserHandle   string `json:"user_handle"`
	Text         string `json:"text"`
	Timestamp    string `json:"timestamp"`
	URL          string `json:"url"`
	RetweetCount int    `json:"retweet_count"`
	LikeCount    int    `json:"like_count"`
	IsRetweet    bool   `json:"is_retweet"`
}

type Project struct {
	Title         string `json:"title"`
	Slug          string `json:"slug"`
	Content       string `json:"content"`
	ProjectOrigin string `json:"project_origin"`
}
