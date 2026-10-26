# AI Mystery Room

AI Mystery Room is a responsive mystery investigation game built with React, Vite, Express, and MongoDB. Cases run in local in-memory mode by default. Set Gemini and MongoDB credentials to enable generated cases and persistence.

## Run locally

1. In `server`, copy `.env.example` to `.env`, then configure any credentials you have. Start the API with `npm install` and `npm run dev`.
2. In `client`, copy `.env.example` to `.env`, run `npm install`, and start Vite with `npm run dev`.
3. Open `http://localhost:5173`.

Without a Gemini key, the server creates a built-in case. Without MongoDB, data is kept in memory until the server restarts. Keep all secret values in `server/.env`; the browser only needs the API URL.

See [SPEC.md](SPEC.md) for the feature and API contract. For deployment, host the server with `CLIENT_URL`, `MONGODB_URI`, and `GEMINI_API_KEY` configured, then deploy the client with `VITE_API_URL` pointed to the server's `/api` endpoint.
