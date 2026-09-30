package db

import (
	"context"
	"database/sql"
	"time"

	"github.com/carlosgmt/morphe/internal/models"
)

func (d *DB) ListLists(ctx context.Context) ([]models.List, error) {
	rows, err := d.pool.QueryContext(ctx,
		`SELECT l.id, l.name, l.icon, l.color, l.sort_order, l.is_default, l.created_at,
		        COALESCE(cnt.n, 0) as card_count
		 FROM lists l
		 LEFT JOIN (SELECT list_id, COUNT(*) as n FROM cards WHERE status != 'archived' GROUP BY list_id) cnt
		   ON cnt.list_id = l.id
		 ORDER BY l.sort_order`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.List
	for rows.Next() {
		var l models.List
		var icon, color sql.NullString
		var created string
		var isDefault int
		if err := rows.Scan(&l.ID, &l.Name, &icon, &color, &l.SortOrder, &isDefault, &created, &l.CardCount); err != nil {
			return nil, err
		}
		if icon.Valid {
			l.Icon = &icon.String
		}
		if color.Valid {
			l.Color = &color.String
		}
		l.IsDefault = isDefault == 1
		l.CreatedAt, _ = time.Parse(sqliteTimeFormat, created)
		out = append(out, l)
	}
	if out == nil {
		out = []models.List{}
	}
	return out, rows.Err()
}

func (d *DB) CreateList(ctx context.Context, req models.CreateListRequest) (*models.List, error) {
	// Get next sort_order
	var maxOrder int
	d.pool.QueryRowContext(ctx, "SELECT COALESCE(MAX(sort_order), 0) FROM lists").Scan(&maxOrder)

	var l models.List
	var icon, color sql.NullString
	var created string
	var isDefault int
	err := d.pool.QueryRowContext(ctx,
		`INSERT INTO lists (name, icon, color, sort_order)
		 VALUES (?, ?, ?, ?)
		 RETURNING id, name, icon, color, sort_order, is_default, created_at`,
		req.Name, req.Icon, req.Color, maxOrder+1,
	).Scan(&l.ID, &l.Name, &icon, &color, &l.SortOrder, &isDefault, &created)
	if err != nil {
		return nil, err
	}
	if icon.Valid {
		l.Icon = &icon.String
	}
	if color.Valid {
		l.Color = &color.String
	}
	l.IsDefault = isDefault == 1
	l.CreatedAt, _ = time.Parse(sqliteTimeFormat, created)
	return &l, nil
}

func (d *DB) UpdateList(ctx context.Context, id string, req models.UpdateListRequest) (*models.List, error) {
	var sets []string
	var args []any

	if req.Name != nil {
		sets = append(sets, "name = ?")
		args = append(args, *req.Name)
	}
	if req.Icon != nil {
		sets = append(sets, "icon = ?")
		args = append(args, *req.Icon)
	}
	if req.Color != nil {
		sets = append(sets, "color = ?")
		args = append(args, *req.Color)
	}
	if req.SortOrder != nil {
		sets = append(sets, "sort_order = ?")
		args = append(args, *req.SortOrder)
	}
	if len(sets) == 0 {
		return d.GetList(ctx, id)
	}

	args = append(args, id)
	query := "UPDATE lists SET " + joinStrings(sets, ", ") + " WHERE id = ? RETURNING id, name, icon, color, sort_order, is_default, created_at"

	var l models.List
	var icon, color sql.NullString
	var created string
	var isDefault int
	err := d.pool.QueryRowContext(ctx, query, args...).Scan(
		&l.ID, &l.Name, &icon, &color, &l.SortOrder, &isDefault, &created)
	if err != nil {
		return nil, err
	}
	if icon.Valid {
		l.Icon = &icon.String
	}
	if color.Valid {
		l.Color = &color.String
	}
	l.IsDefault = isDefault == 1
	l.CreatedAt, _ = time.Parse(sqliteTimeFormat, created)
	return &l, nil
}

func (d *DB) GetList(ctx context.Context, id string) (*models.List, error) {
	var l models.List
	var icon, color sql.NullString
	var created string
	var isDefault int
	err := d.pool.QueryRowContext(ctx,
		`SELECT id, name, icon, color, sort_order, is_default, created_at FROM lists WHERE id = ?`, id,
	).Scan(&l.ID, &l.Name, &icon, &color, &l.SortOrder, &isDefault, &created)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if icon.Valid {
		l.Icon = &icon.String
	}
	if color.Valid {
		l.Color = &color.String
	}
	l.IsDefault = isDefault == 1
	l.CreatedAt, _ = time.Parse(sqliteTimeFormat, created)
	return &l, nil
}

func (d *DB) DeleteList(ctx context.Context, id string) error {
	// Move cards to inbox before deleting
	d.pool.ExecContext(ctx, "UPDATE cards SET list_id = 'inbox' WHERE list_id = ?", id)
	_, err := d.pool.ExecContext(ctx, "DELETE FROM lists WHERE id = ? AND is_default = 0", id)
	return err
}

// ResolveListForIntent returns the list_id that should be assigned based on auto-sort rules.
// Falls back to "inbox" if no rule matches.
func (d *DB) ResolveListForIntent(ctx context.Context, intent string) string {
	var listID string
	err := d.pool.QueryRowContext(ctx,
		"SELECT list_id FROM list_rules WHERE intent = ?", intent,
	).Scan(&listID)
	if err != nil {
		return "inbox"
	}
	return listID
}

func (d *DB) ListRules(ctx context.Context) ([]models.ListRule, error) {
	rows, err := d.pool.QueryContext(ctx, "SELECT id, list_id, intent FROM list_rules ORDER BY intent")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.ListRule
	for rows.Next() {
		var r models.ListRule
		if err := rows.Scan(&r.ID, &r.ListID, &r.Intent); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	if out == nil {
		out = []models.ListRule{}
	}
	return out, rows.Err()
}

func (d *DB) SetRule(ctx context.Context, listID, intent string) error {
	_, err := d.pool.ExecContext(ctx,
		`INSERT INTO list_rules (list_id, intent) VALUES (?, ?)
		 ON CONFLICT(intent) DO UPDATE SET list_id = excluded.list_id`, listID, intent)
	return err
}

func (d *DB) DeleteRule(ctx context.Context, intent string) error {
	_, err := d.pool.ExecContext(ctx, "DELETE FROM list_rules WHERE intent = ?", intent)
	return err
}

func joinStrings(ss []string, sep string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
