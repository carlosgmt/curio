package models

import (
	"encoding/json"
	"time"
)

type Card struct {
	ID         string          `json:"id"`
	ListID     string          `json:"list_id"`
	Intent     string          `json:"intent"`
	Status     string          `json:"status"`
	Title      string          `json:"title"`
	RawText    string          `json:"raw_text"`
	Data       json.RawMessage `json:"data"`
	Tags       []string        `json:"tags"`
	DueAt      *time.Time      `json:"due_at,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
	ArchivedAt *time.Time      `json:"archived_at,omitempty"`
}

type CreateCardRequest struct {
	Intent  string          `json:"intent"`
	Title   string          `json:"title"`
	RawText string          `json:"raw_text"`
	Data    json.RawMessage `json:"data,omitempty"`
	Tags    []string        `json:"tags,omitempty"`
	Status  string          `json:"status,omitempty"`
	ListID  string          `json:"list_id,omitempty"`
	DueAt   *time.Time      `json:"due_at,omitempty"`
}

type UpdateCardRequest struct {
	Title  *string          `json:"title,omitempty"`
	Status *string          `json:"status,omitempty"`
	ListID *string          `json:"list_id,omitempty"`
	Data   *json.RawMessage `json:"data,omitempty"`
	Tags   *[]string        `json:"tags,omitempty"`
	DueAt  *time.Time       `json:"due_at,omitempty"`
}

type CardFilter struct {
	Query    string
	Intents  []string
	Statuses []string
	ListIDs  []string
	Tags     []string
	From     *time.Time
	To       *time.Time
	Sort     string
	Limit    int
	Offset   int
}

type CardStats struct {
	ByIntent map[string]int `json:"by_intent"`
	ByStatus map[string]int `json:"by_status"`
	Total    int            `json:"total"`
}

func ValidStatus(s string) bool {
	switch s {
	case "active", "done", "archived", "expired", "upcoming", "past", "paused":
		return true
	}
	return false
}
