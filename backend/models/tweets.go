package models

type Tweets struct {
	ID           string `json:"id"`
	UserHandle   string `json:"user_handle"`
	Text         string `json:"text"`
	Timestamp    string `json:"timestamp"`
	URL          string `json:"url"`
	RetweetCount int    `json:"retweet_count"`
	LikeCount    int    `json:"like_count"`
	IsRetweet    bool   `json:"is_retweet"`
}
