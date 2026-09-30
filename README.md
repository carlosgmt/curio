# Morphe — Structured Memory with Natural Language Input

A self-hosted personal memory/task system that transforms natural language into structured, searchable cards. Type what you mean — get the right card.

Inspired by [Shapeshift](https://github.com/anishfn/shapeshift) (MIT), rebuilt with proper persistence, search, API, and agent integration.

## Quick Start

```bash
docker compose up -d
```

- **UI:** http://localhost:3100
- **API:** http://localhost:8080/api/v1/

## Architecture

| Component | Tech | Purpose |
|-----------|------|---------|
| Backend | Go + SQLite | REST API, persistence, card lifecycle |
| Frontend | Next.js + React | Card UI, NL input, search |
| AI Classification | TypeSafe Jev (online) / keyword (offline) | Intent detection |
| Image AI | Ollama llava (local) / Gemini (fallback) | Image captioning |
| Agent Integration | REST API + MCP server | Agent-accessible memory |

## Card Types

Event, Reminder, Todo, Timer, Habit, Color, Split, Expense, Convert, Calc, Travel, Poll, Contact, Link, Countdown, Timezone, Random, Goal, Note, **Recipe**, **Apparel**, **Outfit**, Bookmark, Journal, Wishlist, Project.

## API

```bash
# Create a card
curl -X POST http://localhost:8080/api/v1/cards \
  -H 'Content-Type: application/json' \
  -d '{"intent":"todo","title":"Buy groceries","raw_text":"buy milk, eggs, bread"}'

# Search cards
curl 'http://localhost:8080/api/v1/search?q=groceries&intent=todo'

# Get stats
curl http://localhost:8080/api/v1/stats
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MORPHE_DB_PATH` | `./data/morphe.db` | SQLite database path |
| `MORPHE_ATTACHMENTS_DIR` | `./data/attachments` | File storage directory |
| `MORPHE_LISTEN_ADDR` | `:8080` | Backend listen address |
| `TYPESAFE_API_KEY` | _(empty)_ | Optional: enables online Jev model |
| `MORPHE_AI_PROVIDER` | `ollama` | Image AI: `ollama`, `gemini`, `none` |
| `MORPHE_OLLAMA_URL` | `http://localhost:11434` | Ollama endpoint |

## License

MIT
