# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LinkedIn Sci-Fi Poster is a web application that generates LinkedIn posts connecting science fiction themes to current real-world trends. Users can search for sci-fi books/movies, gather research items, and use Claude AI to generate engaging LinkedIn posts.

## Development Commands

### Backend (FastAPI + Python)

```bash
# Navigate to backend
cd backend

# Create/activate virtual environment (requires Python 3.13, not 3.14)
python3.13 -m venv venv
source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run development server (port 8000)
uvicorn app.main:app --reload
```

### Frontend (React + Vite)

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run development server (port 5173, proxies /api to backend)
npm run dev

# Build for production
npm run build
```

### Environment Setup

Copy `backend/.env.example` to `backend/.env` and configure:
- `ANTHROPIC_API_KEY` - Required for AI post generation
- `TMDB_API_KEY` - Required for movie search
- `NEWS_API_KEY` - Required for news search
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` - Required for LinkedIn OAuth

## Architecture

### Backend Structure (`backend/app/`)

**Routers** - FastAPI route handlers:
- `posts.py` - CRUD operations for post drafts
- `ai.py` - Claude AI generation endpoint (`/api/ai/generate`)
- `linkedin.py` - OAuth flow and post publishing
- `search.py` - Book/movie search via external APIs
- `library.py` - User's saved sci-fi items
- `research.py` - Research items linked to posts
- `news.py` - News API integration

**Services** - External API integrations:
- `claude_service.py` - Post generation using Claude API (model: claude-sonnet-4-5-20250514)
- `linkedin_service.py` - LinkedIn OAuth and publishing
- `tmdb_service.py` - Movie search via TMDB API
- `open_library_service.py` - Book search via Open Library
- `news_service.py` - News search

**Models** - SQLAlchemy ORM (SQLite database):
- `Post` - Draft/published posts with tone, status, content
- `SciFiItem` - Library of books/movies (themes stored as JSON string)
- `ResearchItem` - News/URLs linked to posts

### Data Flow for Post Generation

1. User creates a Post linked to a SciFiItem
2. User adds ResearchItems (news articles, URLs)
3. POST `/api/ai/generate` calls `claude_service.generate_post()` with:
   - Sci-fi item details (title, author, year, themes)
   - Research items (title, URL, snippet)
   - Tone (professional_witty, thought_leadership, casual_fun, provocative, storytelling)
4. Generated content saved to Post with draft_number incremented

### Frontend Structure (`frontend/src/`)

- `components/` - React UI components
- `pages/` - Page-level components
- `services/` - API client functions
- `context/` - React context providers
- `hooks/` - Custom React hooks

Frontend runs on port 5173 (Vite dev server) and expects backend on port 8000.

## Key Patterns

- All API routes prefixed with `/api/`
- Database session managed via `get_db()` dependency
- Themes stored as JSON-encoded strings in SQLite, parsed on retrieval
- CORS configured for localhost:5173 only
