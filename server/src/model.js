import mongoose from 'mongoose';

const Person = new mongoose.Schema({ id: String, name: String, role: String, description: String }, { _id: false });
const Clue = new mongoose.Schema({ id: String, title: String, summary: String, detail: String }, { _id: false });
const CaseSchema = new mongoose.Schema({
  premise: { type: String, required: true }, title: { type: String, required: true }, story: { type: String, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true }, suspects: [Person], clues: [Clue], hints: [String],
  culpritId: { type: String, required: true, select: false }, explanation: { type: String, required: true, select: false },
  discoveredClueIds: [String], hintsUsed: { type: Number, default: 0 }, accusationId: String, score: Number
}, { timestamps: true });

export const Case = mongoose.models.Case || mongoose.model('Case', CaseSchema);
