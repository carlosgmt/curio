package api

import (
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/carlosgmt/morphe/internal/db"
)

type handler struct {
	store     *db.DB
	attachDir string
}

func NewRouter(store *db.DB, attachDir string) *chi.Mux {
	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Compress(5))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type"},
		MaxAge:         300,
	}))

	h := &handler{store: store, attachDir: attachDir}

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/cards", h.ListCards)
		r.Post("/cards", h.CreateCard)
		r.Get("/cards/{id}", h.GetCard)
		r.Patch("/cards/{id}", h.UpdateCard)
		r.Delete("/cards/{id}", h.DeleteCard)

		r.Post("/cards/{cardID}/attachments", h.UploadAttachment)
		r.Get("/cards/{cardID}/attachments", h.ListAttachments)
		r.Get("/attachments/{id}/file", h.DownloadAttachment)
		r.Delete("/attachments/{id}", h.DeleteAttachment)

		r.Get("/search", h.SearchCards)
		r.Get("/stats", h.GetStats)

		r.Get("/lists", h.ListLists)
		r.Post("/lists", h.CreateList)
		r.Patch("/lists/{id}", h.UpdateList)
		r.Delete("/lists/{id}", h.DeleteList)
		r.Get("/lists/rules", h.ListRules)
		r.Put("/lists/rules/{intent}", h.SetRule)
		r.Delete("/lists/rules/{intent}", h.DeleteRule)
	})

	return r
}
