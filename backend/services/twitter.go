package services

// import (
// 	"portfolio-backend/config"
// 	"portfolio-backend/models"

// 	"github.com/g8rswimmer/go-twitter/v2"
// )

// var twitterClient *twitter.Client

// // InitTwitterClient initializes the Twitter clientwith the provided configuration
// func InitTwitterClient(cfg *config.Config) {
// 	twitterClient = &twitter.Client{
// 		Authorizer: twitter.Authorizer{
// 			BearerToken: cfg.Twitter.BearerToken,
// 		},
// 	}
// }

// // FetchTweetsFromUser retrieves tweets from a specific user
// func FetchTweetsFromUser(username string) ([]models.Tweet, error) {
// 	opts := twitter.UserTweetTimelineOpts{
// 		TweetFields: []twitter.TweetField{
// 			twitter.TweetFieldCreatedAt,
// 			twitter.TweetFieldText,
// 		},
// 		MaxResults: 10,
// 	}

// 	userTweets, err := twitterClient.UserTweetTimeline(username, opts)
// 	if err != nil {
// 		return nil, err
// 	}

// 	var tweets []models.Tweet
// 	for _, t := range userTweets.Raw.Tweets {
// 		tweets = append(tweets, models.Tweet{
// 			ID:        t.ID,
// 			Text:      t.Text,
// 			CreatedAt: t.CreatedAt,
// 		})
// 	}

// 	return tweets, nil
// }
