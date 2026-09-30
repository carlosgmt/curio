package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/carlosgmt/morphe/internal/api"
	"github.com/carlosgmt/morphe/internal/db"
)

func main() {
	dbPath := envOr("MORPHE_DB_PATH", "./data/morphe.db")
	attachDir := envOr("MORPHE_ATTACHMENTS_DIR", "./data/attachments")
	listenAddr := envOr("MORPHE_LISTEN_ADDR", ":8080")

	// Ensure directories exist
	os.MkdirAll(filepath.Dir(dbPath), 0755)
	os.MkdirAll(attachDir, 0755)

	store, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer store.Close()

	if err := store.Migrate(); err != nil {
		log.Fatalf("run migrations: %v", err)
	}
	log.Printf("database ready: %s", dbPath)

	// Card expiry goroutine
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				n, err := store.ExpireCards(ctx)
				if err != nil {
					log.Printf("expire cards error: %v", err)
				} else if n > 0 {
					log.Printf("expired %d card(s)", n)
				}
			}
		}
	}()

	router := api.NewRouter(store, attachDir)

	srv := &http.Server{
		Addr:         listenAddr,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("morphe listening on %s", listenAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-done
	log.Println("shutting down...")
	cancel()

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		log.Fatalf("shutdown: %v", err)
	}
	log.Println("stopped")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
