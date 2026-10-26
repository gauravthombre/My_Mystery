import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

export const settings = {
  easy: { suspects: 3, clues: 5, hints: 2, base: 100 },
  medium: { suspects: 4, clues: 7, hints: 3, base: 150 },
  hard: { suspects: 5, clues: 9, hints: 3, base: 200 }
};

const shape = z.object({ title: z.string().min(3), story: z.string().min(30), suspects: z.array(z.object({ name: z.string(), role: z.string(), description: z.string() })).min(3), clues: z.array(z.object({ title: z.string(), summary: z.string(), detail: z.string() })).min(5), hints: z.array(z.string()).min(2), culpritIndex: z.number().int().nonnegative(), explanation: z.string().min(20) });

function fallback(premise, difficulty) {
  const names = ['Mara Vale', 'Elias Finch', 'Juniper Cross', 'Theo Mercer', 'Nadia Bell'];
  const clueText = [
    ['A clock stopped at 9:12', 'Its hands were reset after the room was sealed.'],
    ['A fresh trace of blue wax', 'The seal matches a candle from the archive desk.'],
    ['A witness heard the west door', 'The sound came several minutes after the alibi began.'],
    ['A missing ledger page', 'The torn edge fits a scrap found in the conservatory.'],
    ['A damp footprint', 'The soil contains pale greenhouse grit.'],
    ['A coded note', 'The initials point to someone with archive access.'],
    ['A fiber on the latch', 'The thread matches the caretaker’s uniform.'],
    ['A glass with a faint ring', 'Only one suspect was served the house cordial.'],
    ['A second key mark', 'Someone tried the cabinet before the alarm.']
  ];
  const count = settings[difficulty];
  const suspects = names.slice(0, count.suspects).map((name, i) => ({ id: `suspect-${i + 1}`, name, role: ['Curator', 'Caretaker', 'Guest', 'Archivist', 'Investigator'][i], description: `Connected to the case through their access and relationship to the scene.` }));
  const clues = clueText.slice(0, count.clues).map(([title, detail], i) => ({ id: `clue-${i + 1}`, title, summary: `Evidence ${String(i + 1).padStart(2, '0')} is ready to examine.`, detail }));
  const culpritIndex = Math.min(1, suspects.length - 1);
  const culprit = suspects[culpritIndex];
  return { id: randomUUID(), premise, difficulty, title: `The ${['Quiet', 'Vanishing', 'Midnight'][difficulty === 'easy' ? 0 : difficulty === 'medium' ? 1 : 2]} ${premise.split(' ').slice(0, 3).join(' ')}`, story: `${premise}\n\nAt the old Bellweather House, a prized object vanished during a gathering. The doors were watched, the storm cut the telephone line, and every guest had a reason to be near the scene. The timeline contains one deliberate contradiction. Examine the evidence before deciding whom to accuse.`, suspects, clues, hints: ['Start with the timeline: one alibi depends on a detail that the physical evidence contradicts.', 'The evidence links access to the west door and the archive. Compare who could use both.'].slice(0, count.hints), culpritId: culprit.id, explanation: `${culprit.name} had the access to move through the west door. The stopped clock and the fresh wax show the timeline was staged, while the archive clue ties the culprit to the missing object. The other suspects had opportunity, but their stories fit the physical evidence.` };
}

export async function generateCase(premise, difficulty) {
  const config = settings[difficulty];
  if (!process.env.GEMINI_API_KEY) return fallback(premise, difficulty);
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', contents: `Create a fair, logically consistent detective mystery inspired by this premise: ${premise}. Return ONLY valid JSON with title, story, suspects [{name,role,description}], clues [{title,summary,detail}], hints [string], culpritIndex (zero-based), explanation. Exactly ${config.suspects} suspects, ${config.clues} clues, and ${config.hints} hints. Make all evidence details relevant, the culprit listed, and the explanation explicitly supported by clues. Do not use markdown.` });
    const raw = response.text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const data = shape.parse(JSON.parse(raw));
    if (data.suspects.length !== config.suspects || data.clues.length !== config.clues || data.hints.length !== config.hints || data.culpritIndex >= data.suspects.length) throw new Error('Generated case has invalid counts');
    const suspects = data.suspects.map((s, i) => ({ ...s, id: `suspect-${i + 1}` }));
    return { id: randomUUID(), premise, difficulty, title: data.title, story: data.story, suspects, clues: data.clues.map((c, i) => ({ ...c, id: `clue-${i + 1}` })), hints: data.hints, culpritId: suspects[data.culpritIndex].id, explanation: data.explanation };
  } catch (error) {
    console.error('Gemini generation failed; using local generator:', error.message);
    return fallback(premise, difficulty);
  }
}
