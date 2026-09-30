package models

import "time"

type Attachment struct {
	ID        string    `json:"id"`
	CardID    string    `json:"card_id"`
	Filename  string    `json:"filename"`
	MimeType  string    `json:"mime_type"`
	SizeBytes int64     `json:"size_bytes"`
	AICaption *string   `json:"ai_caption,omitempty"`
	Path      string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
}
