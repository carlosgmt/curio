package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/carlosgmt/morphe/internal/models"
)

func (h *handler) ListCards(w http.ResponseWriter, r *http.Request) {
	f := parseCardFilter(r)
	cards, total, err := h.store.ListCards(r.Context(), f)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"cards": cards, "total": total})
}

func (h *handler) CreateCard(w http.ResponseWriter, r *http.Request) {
	var req models.CreateCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Intent == "" || req.Title == "" {
		writeError(w, http.StatusBadRequest, "intent and title are required")
		return
	}
	if req.RawText == "" {
		req.RawText = req.Title
	}
	if req.Status != "" && !models.ValidStatus(req.Status) {
		writeError(w, http.StatusBadRequest, "invalid status")
		return
	}

	card, err := h.store.CreateCard(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, card)
}

func (h *handler) GetCard(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	card, err := h.store.GetCard(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if card == nil {
		writeError(w, http.StatusNotFound, "card not found")
		return
	}
	writeJSON(w, http.StatusOK, card)
}

func (h *handler) UpdateCard(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req models.UpdateCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Status != nil && !models.ValidStatus(*req.Status) {
		writeError(w, http.StatusBadRequest, "invalid status")
		return
	}

	card, err := h.store.UpdateCard(r.Context(), id, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, card)
}

func (h *handler) DeleteCard(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.store.DeleteCard(r.Context(), id); err != nil {
		writeError(w, http.StatusNotFound, "card not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *handler) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.store.GetStats(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (h *handler) SearchCards(w http.ResponseWriter, r *http.Request) {
	f := parseCardFilter(r)
	cards, total, err := h.store.SearchCards(r.Context(), f)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"cards": cards, "total": total})
}

// Helpers

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func parseCardFilter(r *http.Request) models.CardFilter {
	q := r.URL.Query()
	f := models.CardFilter{
		Query:  q.Get("q"),
		Sort:   q.Get("sort"),
		Offset: atoi(q.Get("offset"), 0),
		Limit:  atoi(q.Get("limit"), 20),
	}
	if v := q.Get("intent"); v != "" {
		f.Intents = strings.Split(v, ",")
	}
	if v := q.Get("status"); v != "" {
		f.Statuses = strings.Split(v, ",")
	}
	if v := q.Get("tags"); v != "" {
		f.Tags = strings.Split(v, ",")
	}
	if v := q.Get("list"); v != "" {
		f.ListIDs = strings.Split(v, ",")
	}
	if v := q.Get("from"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			f.From = &t
		}
	}
	if v := q.Get("to"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			f.To = &t
		}
	}
	return f
}

func atoi(s string, def int) int {
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return v
}
