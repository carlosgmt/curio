package models

import "time"

type List struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Icon      *string   `json:"icon,omitempty"`
	Color     *string   `json:"color,omitempty"`
	SortOrder int       `json:"sort_order"`
	IsDefault bool      `json:"is_default"`
	CardCount int       `json:"card_count,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateListRequest struct {
	Name  string  `json:"name"`
	Icon  *string `json:"icon,omitempty"`
	Color *string `json:"color,omitempty"`
}

type UpdateListRequest struct {
	Name      *string `json:"name,omitempty"`
	Icon      *string `json:"icon,omitempty"`
	Color     *string `json:"color,omitempty"`
	SortOrder *int    `json:"sort_order,omitempty"`
}

type ListRule struct {
	ID     string `json:"id"`
	ListID string `json:"list_id"`
	Intent string `json:"intent"`
}
