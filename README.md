# FinSight — AI Financial Companion

FastAPI backend under `backend/` plus a React + Tailwind dashboard in `frontend/`.

## Backend

```bash
cd finHACk
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# Configure API keys in `.env` (see `backend/utils/env_keys.py` for supported names)
uvicorn app:app --reload --host 127.0.0.1 --port 8001
```

Docs: [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs)

### Layout

- `app.py` — FastAPI app, mounts `backend.routes.router`
- `backend/routes/` — HTTP routes
- `backend/services/` — yfinance (quotes/OHLC), GNews + yfinance headlines, FRED, Gemini, ElevenLabs, **Zapier + Twilio alerts**, **Clerk JWT + Backend API** (`GNEWS_API_KEY`, optional `OPENAI_API_KEY`)
- `GET /auth/clerk-config` — publishable key for the Clerk frontend SDK
- `GET /auth/me` — requires `Authorization: Bearer <Clerk session JWT>`; uses **Clerk Backend API** (`CLERK_SECRET_KEY`) to load the user
- `POST /alerts/trigger` — JSON to **Zapier** (`ZAPIER_WEBHOOK_URL`) and optional **Twilio SMS**; attach Clerk `Bearer` to include `user_id` in the webhook payload

**Alert / Clerk env (see `backend/utils/env_keys.py`):** `ZAPIER_WEBHOOK_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (or `Twillio`), `TWILIO_FROM_NUMBER`, `ALERT_SMS_TO`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- `backend/models/schemas.py` — optional Pydantic models (yours to extend)

## Frontend

```bash
cd frontend
npm install
npm run dev
```

**Frontend env (`frontend/.env`):** `VITE_API_URL` (e.g. `http://127.0.0.1:8001`), `VITE_CLERK_PUBLISHABLE_KEY` (same value as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in the API `.env`). **Alerts:** set `ZAPIER_WEBHOOK_URL` or `ALERT_WEBHOOK_URL` in the API `.env` so webhooks actually send.
