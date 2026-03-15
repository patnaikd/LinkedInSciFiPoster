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

### LinkedIn OAuth Credentials (Required for publishing)

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Click **Create App**
3. Fill in app details (name, LinkedIn page, logo)
4. After creation, go to the **Auth** tab
5. Add `http://localhost:8000/api/linkedin/callback` to **Authorized redirect URLs**
6. Go to the **Products** tab and request access to:
   - **Share on LinkedIn**
   - **Sign In with LinkedIn using OpenID Connect**
7. Copy **Client ID** and **Client Secret** from the Auth tab

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
   LINKEDIN_CLIENT_ID=your-client-id
   LINKEDIN_CLIENT_SECRET=your-client-secret
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
