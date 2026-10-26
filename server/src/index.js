import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Case } from './model.js';
import { generateCase, settings } from './generator.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '20kb' }));
const memory = new Map();
// Start in demo mode and switch to MongoDB only after a successful connection.
// This keeps the game usable when Atlas is unreachable or its credentials are absent.
let useMongo = false;
const createSchema = z.object({ premise: z.string().trim().min(3).max(500), difficulty: z.enum(['easy', 'medium', 'hard']) });

async function save(data) {
  if (useMongo) return (await Case.create(data)).toObject();
  memory.set(data.id, data);
  return data;
}
async function find(id) {
  if (useMongo) return Case.findById(id).select('+culpritId +explanation').lean();
  return memory.get(id);
}
function publicCase(c) {
  if (!c) return null;
  const discovered = new Set(c.discoveredClueIds || []);
  return { id: String(c._id || c.id), title: c.title, story: c.story, difficulty: c.difficulty,
    suspects: c.suspects, clues: c.clues.map(({ id, title, summary, detail }) => ({ id, title, summary, ...(discovered.has(id) ? { detail } : {}), discovered: discovered.has(id) })),
    hintsRemaining: settings[c.difficulty].hints - c.hintsUsed, progress: { discovered: discovered.size, total: c.clues.length, hintsUsed: c.hintsUsed }, completed: Boolean(c.accusationId) };
}
async function persist(c) { if (useMongo) await Case.findByIdAndUpdate(c._id, { $set: { discoveredClueIds: c.discoveredClueIds, hintsUsed: c.hintsUsed, accusationId: c.accusationId, score: c.score } }); else memory.set(c.id, c); }
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/cases', route(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a premise between 3 and 500 characters and choose a valid difficulty.' });
  const generated = await generateCase(parsed.data.premise, parsed.data.difficulty);
  const c = await save({ ...generated, discoveredClueIds: [], hintsUsed: 0 });
  res.status(201).json({ case: publicCase(c) });
}));
app.get('/api/cases/:id', route(async (req, res) => {
  const c = await find(req.params.id); if (!c) return res.status(404).json({ error: 'Case not found.' });
  if (c.accusationId) return res.status(409).json({ error: 'This case is complete. Retrieve its result instead.' });
  res.json({ case: publicCase(c) });
}));
app.post('/api/cases/:id/clues/:clueId/discover', route(async (req, res) => {
  const c = await find(req.params.id); if (!c) return res.status(404).json({ error: 'Case not found.' });
  if (c.accusationId) return res.status(409).json({ error: 'This case is already complete.' });
  if (!c.clues.some(x => x.id === req.params.clueId)) return res.status(404).json({ error: 'Clue not found.' });
  if (!c.discoveredClueIds.includes(req.params.clueId)) c.discoveredClueIds.push(req.params.clueId);
  await persist(c); res.json({ case: publicCase(c) });
}));
app.post('/api/cases/:id/hints', route(async (req, res) => {
  const c = await find(req.params.id); if (!c) return res.status(404).json({ error: 'Case not found.' });
  if (c.accusationId) return res.status(409).json({ error: 'This case is already complete.' });
  if (c.hintsUsed >= c.hints.length) return res.status(409).json({ error: 'No hints remain.' });
  const hint = c.hints[c.hintsUsed++]; await persist(c); res.json({ hint, hintsRemaining: c.hints.length - c.hintsUsed });
}));
app.post('/api/cases/:id/accuse', route(async (req, res) => {
  const c = await find(req.params.id); if (!c) return res.status(404).json({ error: 'Case not found.' });
  if (c.accusationId) return res.status(409).json({ error: 'An accusation was already submitted.' });
  const suspectId = z.string().safeParse(req.body?.suspectId);
  if (!suspectId.success || !c.suspects.some(s => s.id === suspectId.data)) return res.status(400).json({ error: 'Choose a valid suspect.' });
  c.accusationId = suspectId.data;
  const correct = c.accusationId === c.culpritId;
  c.score = Math.max(0, (correct ? settings[c.difficulty].base : 0) + c.discoveredClueIds.length * 5 - c.hintsUsed * 10);
  await persist(c); res.json({ result: { correct, culprit: c.suspects.find(s => s.id === c.culpritId), explanation: c.explanation, score: c.score, difficulty: c.difficulty } });
}));
app.get('/api/cases/:id/result', route(async (req, res) => {
  const c = await find(req.params.id); if (!c) return res.status(404).json({ error: 'Case not found.' });
  if (!c.accusationId) return res.status(409).json({ error: 'Submit an accusation before viewing the result.' });
  res.json({ result: { correct: c.accusationId === c.culpritId, culprit: c.suspects.find(s => s.id === c.culpritId), explanation: c.explanation, score: c.score, difficulty: c.difficulty } });
}));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Something went wrong. Please try again.' }); });

const port = process.env.PORT || 5000;
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => { useMongo = true; console.log('MongoDB connected; persistent storage enabled.'); })
    .catch(err => console.error('MongoDB unavailable; using temporary in-memory storage:', err.message));
}
app.listen(port, () => console.log(`Mystery API listening on ${port}`));
