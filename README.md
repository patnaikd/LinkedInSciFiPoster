# LinkedIn Sci-Fi Poster (LinkedInSciFiPoster)

A web application that generates LinkedIn posts connecting science fiction themes to current real-world trends using Claude AI.

## Getting API Keys

### Anthropic API Key (Required for AI generation)

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys** in the left sidebar
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-`)

### TMDB API Key (Required for movie search)

1. Go to [themoviedb.org](https://www.themoviedb.org/)
2. Create an account and verify your email
3. Go to **Settings** → **API** (or visit [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api))
4. Request an API key (select "Developer" for personal use)
5. Fill out the application form
6. Copy the **API Key (v3 auth)**

### News API Key (Required for news search)

1. Go to [newsapi.org](https://newsapi.org/)
2. Click **Get API Key**
3. Create an account
4. Copy the API key from the dashboard

### fal.ai API Key (Required for image generation)

1. Go to [fal.ai](https://fal.ai/)
2. Sign up or log in
3. Navigate to **Keys** in the dashboard
4. Click **Add key**
5. Copy the generated key

## Setup

1. Copy the environment template:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Add your API keys to `backend/.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-xxx
   TMDB_API_KEY=your-tmdb-key
   NEWS_API_KEY=your-newsapi-key
   FAL_KEY=your-fal-ai-key
   ```

3. Install and run the backend:
   ```bash
   cd backend
   python3.13 -m venv venv        # must use Python 3.13 (not 3.14)
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

4. Install and run the frontend (in a new terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Open the app at `http://localhost:5173`
   - Backend API: `http://localhost:8000`
   - API docs (Swagger): `http://localhost:8000/docs`

## Deploying to Render

The project includes a `render.yaml` for one-click deployment to [Render](https://render.com). The build process compiles the frontend into static files and serves them from the FastAPI backend — a single service handles everything.

### Steps

1. **Push your code to GitHub.**

2. **Connect to Render**
   - Go to [render.com](https://render.com) and sign in
   - Click **New** → **Blueprint**
   - Connect your GitHub repository
   - Render will auto-detect `render.yaml` and configure the service

3. **Set secret environment variables**
   During setup (or via the Render dashboard under Environment), add:
   - `ANTHROPIC_API_KEY`
   - `TMDB_API_KEY`
   - `NEWS_API_KEY`
   - `FAL_KEY`
   - `ALLOWED_ORIGINS` — set to your Render app URL once deployed (e.g. `https://linkedin-scifi-poster.onrender.com`)

4. **Deploy** — click **Apply** and Render will build and start the service automatically.

### SQLite persistence warning

The default config uses SQLite (`sqlite:///./scifi_poster.db`). On Render's free plan, the filesystem is ephemeral — **the database will be wiped on every deploy or restart**.

To persist data, add a [Render Disk](https://render.com/docs/disks) ($1/mo) and update `DATABASE_URL` in the Render dashboard to point to it:

```
DATABASE_URL=sqlite:////data/scifi_poster.db
```
