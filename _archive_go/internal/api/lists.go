package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/carlosgmt/morphe/internal/models"
)

func (h *handler) ListLists(w http.ResponseWriter, r *http.Request) {
	lists, err := h.store.ListLists(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, lists)
}

func (h *handler) CreateList(w http.ResponseWriter, r *http.Request) {
	var req models.CreateListRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	list, err := h.store.CreateList(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, list)
}

func (h *handler) UpdateList(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req models.UpdateListRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	list, err := h.store.UpdateList(r.Context(), id, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *handler) DeleteList(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.store.DeleteList(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *handler) ListRules(w http.ResponseWriter, r *http.Request) {
	rules, err := h.store.ListRules(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rules)
}

func (h *handler) SetRule(w http.ResponseWriter, r *http.Request) {
	intent := chi.URLParam(r, "intent")
	var body struct {
		ListID string `json:"list_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ListID == "" {
		writeError(w, http.StatusBadRequest, "list_id is required")
		return
	}
	if err := h.store.SetRule(r.Context(), body.ListID, intent); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *handler) DeleteRule(w http.ResponseWriter, r *http.Request) {
	intent := chi.URLParam(r, "intent")
	if err := h.store.DeleteRule(r.Context(), intent); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
