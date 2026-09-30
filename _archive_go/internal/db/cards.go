package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/carlosgmt/morphe/internal/models"
)

const sqliteTimeFormat = "2006-01-02 15:04:05"

func (d *DB) CreateCard(ctx context.Context, req models.CreateCardRequest) (*models.Card, error) {
	if req.Status == "" {
		req.Status = "active"
	}
	if req.Data == nil {
		req.Data = json.RawMessage(`{}`)
	}
	if req.Tags == nil {
		req.Tags = []string{}
	}
	tagsJSON, _ := json.Marshal(req.Tags)

	// Auto-assign list based on intent if not explicitly set
	if req.ListID == "" {
		req.ListID = d.ResolveListForIntent(ctx, req.Intent)
	}

	var dueAt *string
	if req.DueAt != nil {
		s := req.DueAt.UTC().Format(sqliteTimeFormat)
		dueAt = &s
	}

	row := d.pool.QueryRowContext(ctx,
		`INSERT INTO cards (intent, status, title, raw_text, data, tags, list_id, due_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 RETURNING id, list_id, intent, status, title, raw_text, data, tags, due_at, created_at, updated_at, archived_at`,
		req.Intent, req.Status, req.Title, req.RawText, string(req.Data), string(tagsJSON), req.ListID, dueAt,
	)
	return scanCard(row)
}

func (d *DB) GetCard(ctx context.Context, id string) (*models.Card, error) {
	row := d.pool.QueryRowContext(ctx,
		`SELECT id, list_id, intent, status, title, raw_text, data, tags, due_at, created_at, updated_at, archived_at
		 FROM cards WHERE id = ?`, id,
	)
	card, err := scanCard(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return card, err
}

func (d *DB) ListCards(ctx context.Context, f models.CardFilter) ([]models.Card, int, error) {
	return d.queryCards(ctx, f, false)
}

func (d *DB) SearchCards(ctx context.Context, f models.CardFilter) ([]models.Card, int, error) {
	return d.queryCards(ctx, f, f.Query != "")
}

func (d *DB) queryCards(ctx context.Context, f models.CardFilter, useFTS bool) ([]models.Card, int, error) {
	var where []string
	var args []any

	fromTable := "cards c"
	selectCols := "c.id, c.list_id, c.intent, c.status, c.title, c.raw_text, c.data, c.tags, c.due_at, c.created_at, c.updated_at, c.archived_at"

	if useFTS {
		fromTable = "cards c JOIN cards_fts f ON c.rowid = f.rowid"
		where = append(where, "f.cards_fts MATCH ?")
		args = append(args, f.Query)
	}

	if len(f.Intents) > 0 {
		placeholders := strings.Repeat("?,", len(f.Intents))
		placeholders = placeholders[:len(placeholders)-1]
		where = append(where, fmt.Sprintf("c.intent IN (%s)", placeholders))
		for _, v := range f.Intents {
			args = append(args, v)
		}
	}

	if len(f.Statuses) > 0 {
		placeholders := strings.Repeat("?,", len(f.Statuses))
		placeholders = placeholders[:len(placeholders)-1]
		where = append(where, fmt.Sprintf("c.status IN (%s)", placeholders))
		for _, v := range f.Statuses {
			args = append(args, v)
		}
	}

	if len(f.ListIDs) > 0 {
		placeholders := strings.Repeat("?,", len(f.ListIDs))
		placeholders = placeholders[:len(placeholders)-1]
		where = append(where, fmt.Sprintf("c.list_id IN (%s)", placeholders))
		for _, v := range f.ListIDs {
			args = append(args, v)
		}
	}

	if len(f.Tags) > 0 {
		for _, tag := range f.Tags {
			where = append(where, "EXISTS (SELECT 1 FROM json_each(c.tags) WHERE json_each.value = ?)")
			args = append(args, tag)
		}
	}

	if f.From != nil {
		where = append(where, "c.created_at >= ?")
		args = append(args, f.From.UTC().Format(sqliteTimeFormat))
	}
	if f.To != nil {
		where = append(where, "c.created_at <= ?")
		args = append(args, f.To.UTC().Format(sqliteTimeFormat))
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	// Count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s %s", fromTable, whereClause)
	var total int
	if err := d.pool.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count cards: %w", err)
	}

	// Sort
	orderBy := "c.created_at DESC"
	switch f.Sort {
	case "updated_at":
		orderBy = "c.updated_at DESC"
	case "due_at":
		orderBy = "c.due_at ASC NULLS LAST"
	case "created_at_asc":
		orderBy = "c.created_at ASC"
	}

	limit := f.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	query := fmt.Sprintf("SELECT %s FROM %s %s ORDER BY %s LIMIT ? OFFSET ?",
		selectCols, fromTable, whereClause, orderBy)
	args = append(args, limit, f.Offset)

	rows, err := d.pool.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query cards: %w", err)
	}
	defer rows.Close()

	var cards []models.Card
	for rows.Next() {
		card, err := scanCardRow(rows)
		if err != nil {
			return nil, 0, err
		}
		cards = append(cards, *card)
	}
	if cards == nil {
		cards = []models.Card{}
	}
	return cards, total, rows.Err()
}

func (d *DB) UpdateCard(ctx context.Context, id string, req models.UpdateCardRequest) (*models.Card, error) {
	var sets []string
	var args []any

	if req.Title != nil {
		sets = append(sets, "title = ?")
		args = append(args, *req.Title)
	}
	if req.Status != nil {
		sets = append(sets, "status = ?")
		args = append(args, *req.Status)
		if *req.Status == "archived" {
			sets = append(sets, "archived_at = datetime('now')")
		}
	}
	if req.Data != nil {
		sets = append(sets, "data = ?")
		args = append(args, string(*req.Data))
	}
	if req.Tags != nil {
		tagsJSON, _ := json.Marshal(*req.Tags)
		sets = append(sets, "tags = ?")
		args = append(args, string(tagsJSON))
	}
	if req.DueAt != nil {
		sets = append(sets, "due_at = ?")
		args = append(args, req.DueAt.UTC().Format(sqliteTimeFormat))
	}
	if req.ListID != nil {
		sets = append(sets, "list_id = ?")
		args = append(args, *req.ListID)
	}

	if len(sets) == 0 {
		return d.GetCard(ctx, id)
	}

	sets = append(sets, "updated_at = datetime('now')")
	args = append(args, id)

	query := fmt.Sprintf(
		`UPDATE cards SET %s WHERE id = ?
		 RETURNING id, list_id, intent, status, title, raw_text, data, tags, due_at, created_at, updated_at, archived_at`,
		strings.Join(sets, ", "),
	)

	row := d.pool.QueryRowContext(ctx, query, args...)
	return scanCard(row)
}

func (d *DB) DeleteCard(ctx context.Context, id string) error {
	res, err := d.pool.ExecContext(ctx, "DELETE FROM cards WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete card: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (d *DB) GetStats(ctx context.Context) (*models.CardStats, error) {
	stats := &models.CardStats{
		ByIntent: make(map[string]int),
		ByStatus: make(map[string]int),
	}

	rows, err := d.pool.QueryContext(ctx, "SELECT intent, COUNT(*) FROM cards GROUP BY intent")
	if err != nil {
		return nil, fmt.Errorf("stats by intent: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var k string
		var v int
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		stats.ByIntent[k] = v
		stats.Total += v
	}

	rows2, err := d.pool.QueryContext(ctx, "SELECT status, COUNT(*) FROM cards GROUP BY status")
	if err != nil {
		return nil, fmt.Errorf("stats by status: %w", err)
	}
	defer rows2.Close()
	for rows2.Next() {
		var k string
		var v int
		if err := rows2.Scan(&k, &v); err != nil {
			return nil, err
		}
		stats.ByStatus[k] = v
	}

	return stats, nil
}

func (d *DB) ExpireCards(ctx context.Context) (int64, error) {
	res, err := d.pool.ExecContext(ctx,
		`UPDATE cards SET status = 'expired', updated_at = datetime('now')
		 WHERE status = 'active' AND due_at IS NOT NULL AND due_at < datetime('now')`)
	if err != nil {
		return 0, fmt.Errorf("expire cards: %w", err)
	}
	return res.RowsAffected()
}

// Attachment queries

func (d *DB) CreateAttachment(ctx context.Context, a *models.Attachment) error {
	_, err := d.pool.ExecContext(ctx,
		`INSERT INTO attachments (id, card_id, filename, mime_type, size_bytes, ai_caption, path)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.CardID, a.Filename, a.MimeType, a.SizeBytes, a.AICaption, a.Path,
	)
	return err
}

func (d *DB) ListAttachments(ctx context.Context, cardID string) ([]models.Attachment, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT id, card_id, filename, mime_type, size_bytes, ai_caption, path, created_at
		 FROM attachments WHERE card_id = ? ORDER BY created_at`, cardID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Attachment
	for rows.Next() {
		var a models.Attachment
		var caption sql.NullString
		var created string
		if err := rows.Scan(&a.ID, &a.CardID, &a.Filename, &a.MimeType, &a.SizeBytes, &caption, &a.Path, &created); err != nil {
			return nil, err
		}
		if caption.Valid {
			a.AICaption = &caption.String
		}
		a.CreatedAt, _ = time.Parse(sqliteTimeFormat, created)
		out = append(out, a)
	}
	if out == nil {
		out = []models.Attachment{}
	}
	return out, rows.Err()
}

func (d *DB) GetAttachment(ctx context.Context, id string) (*models.Attachment, error) {
	var a models.Attachment
	var caption sql.NullString
	var created string
	err := d.pool.QueryRowContext(ctx,
		`SELECT id, card_id, filename, mime_type, size_bytes, ai_caption, path, created_at
		 FROM attachments WHERE id = ?`, id,
	).Scan(&a.ID, &a.CardID, &a.Filename, &a.MimeType, &a.SizeBytes, &caption, &a.Path, &created)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if caption.Valid {
		a.AICaption = &caption.String
	}
	a.CreatedAt, _ = time.Parse(sqliteTimeFormat, created)
	return &a, nil
}

func (d *DB) DeleteAttachment(ctx context.Context, id string) error {
	_, err := d.pool.ExecContext(ctx, "DELETE FROM attachments WHERE id = ?", id)
	return err
}

// Scan helpers

type scannable interface {
	Scan(dest ...any) error
}

func scanCard(s scannable) (*models.Card, error) {
	var c models.Card
	var dataStr, tagsStr string
	var dueAt, createdAt, updatedAt, archivedAt sql.NullString

	err := s.Scan(&c.ID, &c.ListID, &c.Intent, &c.Status, &c.Title, &c.RawText,
		&dataStr, &tagsStr, &dueAt, &createdAt, &updatedAt, &archivedAt)
	if err != nil {
		return nil, err
	}

	c.Data = json.RawMessage(dataStr)
	json.Unmarshal([]byte(tagsStr), &c.Tags)
	if c.Tags == nil {
		c.Tags = []string{}
	}

	if dueAt.Valid {
		t, _ := time.Parse(sqliteTimeFormat, dueAt.String)
		c.DueAt = &t
	}
	if createdAt.Valid {
		c.CreatedAt, _ = time.Parse(sqliteTimeFormat, createdAt.String)
	}
	if updatedAt.Valid {
		c.UpdatedAt, _ = time.Parse(sqliteTimeFormat, updatedAt.String)
	}
	if archivedAt.Valid {
		t, _ := time.Parse(sqliteTimeFormat, archivedAt.String)
		c.ArchivedAt = &t
	}

	return &c, nil
}

func scanCardRow(rows *sql.Rows) (*models.Card, error) {
	return scanCard(rows)
}
