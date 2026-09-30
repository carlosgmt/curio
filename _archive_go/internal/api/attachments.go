package api

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/carlosgmt/morphe/internal/models"
)

const maxUploadSize = 10 << 20 // 10 MB

func (h *handler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardID")

	// Verify card exists
	card, err := h.store.GetCard(r.Context(), cardID)
	if err != nil || card == nil {
		writeError(w, http.StatusNotFound, "card not found")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "file too large (max 10 MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing file field")
		return
	}
	defer file.Close()

	// Generate ID and path
	id := generateID()
	ext := filepath.Ext(header.Filename)
	dir := filepath.Join(h.attachDir, cardID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		writeError(w, http.StatusInternalServerError, "cannot create directory")
		return
	}

	relPath := filepath.Join(cardID, id+ext)
	absPath := filepath.Join(h.attachDir, relPath)

	dst, err := os.Create(absPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "cannot create file")
		return
	}
	defer dst.Close()

	written, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(absPath)
		writeError(w, http.StatusInternalServerError, "cannot write file")
		return
	}

	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	att := &models.Attachment{
		ID:        id,
		CardID:    cardID,
		Filename:  header.Filename,
		MimeType:  mimeType,
		SizeBytes: written,
		Path:      relPath,
	}

	if err := h.store.CreateAttachment(r.Context(), att); err != nil {
		os.Remove(absPath)
		writeError(w, http.StatusInternalServerError, "cannot save attachment record")
		return
	}

	writeJSON(w, http.StatusCreated, att)
}

func (h *handler) ListAttachments(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardID")
	atts, err := h.store.ListAttachments(r.Context(), cardID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, atts)
}

func (h *handler) DownloadAttachment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	att, err := h.store.GetAttachment(r.Context(), id)
	if err != nil || att == nil {
		writeError(w, http.StatusNotFound, "attachment not found")
		return
	}

	absPath := filepath.Join(h.attachDir, att.Path)
	// Prevent path traversal
	if !strings.HasPrefix(filepath.Clean(absPath), filepath.Clean(h.attachDir)) {
		writeError(w, http.StatusForbidden, "invalid path")
		return
	}

	w.Header().Set("Content-Type", att.MimeType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, att.Filename))
	http.ServeFile(w, r, absPath)
}

func (h *handler) DeleteAttachment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	att, err := h.store.GetAttachment(r.Context(), id)
	if err != nil || att == nil {
		writeError(w, http.StatusNotFound, "attachment not found")
		return
	}

	absPath := filepath.Join(h.attachDir, att.Path)
	os.Remove(absPath)

	if err := h.store.DeleteAttachment(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
