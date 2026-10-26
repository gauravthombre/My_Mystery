# AI Mystery Room — Project Specification

## Overview
AI Mystery Room is a responsive, single-player investigation game. A player enters a premise, chooses Easy, Medium, or Hard, investigates a generated case, asks for limited hints, and accuses a suspect. The server owns the solution and calculates the final score.

## Users and experience
Designed for students and casual puzzle fans. The experience should feel like opening a case file: clear narrative, readable evidence, distinct suspects, visible progress, and a satisfying explanation. No account is required.

## User journey and screens
1. **Home:** Introduce the game and link to create a case.
2. **Create mystery:** Enter a premise (3–500 characters), choose difficulty, and generate.
3. **Investigation room:** Read the case story, inspect suspects and evidence, reveal clues one at a time, and request available hints. Show discovered count and hint usage; never include culprit or solution in the response.
4. **Accusation:** Choose one suspect and submit. The accusation is final.
5. **Results:** Show verdict, culprit, explanation, score, and a new-case action.

Loading states disable duplicate submissions and show progress. API errors are shown inline with a retry path. Layout adapts to mobile and desktop; navigation remains within the app.

## Features
Required: mystery generation, three difficulty levels, suspect and clue investigation, limited hints, accusation, backend verdict and scoring, solution confidentiality, restart. Enhancements: expressive case-file UI, clue reveal sequencing, local in-memory fallback if MongoDB is unavailable.

## Stack
- Client: React, Vite, React Router, Axios, Tailwind CSS.
- Server: Node.js, Express, Mongoose, Zod, Gemini via `@google/genai`.
- Persistence: MongoDB when `MONGODB_URI` is configured; in-memory store for local/demo use otherwise.

## Difficulty and scoring
| Level | Suspects | Clues | Hints | Correct base |
| --- | ---: | ---: | ---: | ---: |
| Easy | 3 | 5 | 2 | 100 |
| Medium | 4 | 7 | 3 | 150 |
| Hard | 5 | 9 | 3 | 200 |

Score = max(0, (correct ? base : 0) + discovered clues × 5 − hints used × 10). Only the server computes it. A generated solution must identify a listed suspect and be supported by evidence; validate shape and counts before accepting it.

## API
All JSON. Errors use `{ "error": "Human-readable message" }` and appropriate 4xx/5xx status.
- `POST /api/cases` body `{ premise, difficulty }`; returns `{ case: { id, title, story, difficulty, suspects, clues: [{id,title,summary,discovered}], hintsRemaining, progress } }` (clue details hidden until discovered).
- `GET /api/cases/:id`; returns the same public case view.
- `POST /api/cases/:id/clues/:clueId/discover`; reveals one clue and returns the public case.
- `POST /api/cases/:id/hints`; returns `{ hint, hintsRemaining }`.
- `POST /api/cases/:id/accuse` body `{ suspectId }`; finalizes accusation and returns result.
- `GET /api/cases/:id/result`; only available after accusation; returns `{ correct, culprit, explanation, score, difficulty }`.

Validation: premise length 3–500, supported difficulty, valid case/clue/suspect IDs, one accusation, clues discoverable only once, hint limit enforced. Never serialize `culpritId`, solution, or unrevealed clue content in active-case responses. Gemini output is parsed and validated server-side; fall back safely when unavailable or malformed.

## Data model
Case: premise, title, story, difficulty, suspects `{id,name,role,description}`, clues `{id,title,summary,detail}`, hints, `culpritId`, `explanation`, discovered clue IDs, hints used, accusation ID, score, timestamps. Solution fields are private server data.

## Configuration and security
Server `.env`: `PORT=5000`, `MONGODB_URI=`, `GEMINI_API_KEY=`, `CLIENT_URL=http://localhost:5173`, optional `GEMINI_MODEL=gemini-2.5-flash`. Never put secrets in client code or commit `.env`. Restrict CORS to `CLIENT_URL`, validate inputs, and keep solution fields out of public serializers.

## Limitations and deliverables
No login, multiplayer, or guaranteed persistence without MongoDB. Deliver source, this specification, environment examples, and deployment guidance. Deploy server with MongoDB Atlas and client to Vercel; configure client API URL and server environment variables.

## Acceptance criteria
- Generate and play Easy, Medium, and Hard cases.
- Clues reveal progressively; hints are limited; accusation is final.
- Active-case API and client never expose culprit or solution.
- Server validates generated cases and calculates scores.
- Result reveals the true culprit and a clue-grounded explanation.
- UI handles mobile sizing, loading, empty and API-error states.
- Production deployment can run the full workflow with configured services.
