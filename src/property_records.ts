import { z } from "zod";

export const PropertyDoc = z.object({
  id: z.string().min(1),
  unit: z.string().min(1),
  kind: z.enum(["maintenance_request", "tenant_document", "inspection_reminder"]),
  body: z.string().min(1),
  /** ISO date the record was filed; inspection reminders use the due date. */
  filed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type PropertyDoc = z.infer<typeof PropertyDoc>;

export const LookupRequest = z.object({
  question: z.string().min(3).max(500),
  unit: z.string().min(1).optional(),
  kind: PropertyDoc.shape.kind.optional(),
  top_k: z.number().int().min(1).max(20).default(5),
});
export type LookupRequest = z.infer<typeof LookupRequest>;

export type Chunk = {
  /** Stable across re-ingests, so replaying the pipeline overwrites instead of duplicating. */
  id: string;
  text: string;
  metadata: { doc_id: string; unit: string; kind: PropertyDoc["kind"]; filed_on: string; part: number };
};

const MAX_CHARS = 700;

/**
 * A maintenance request is a short paragraph; a signed lease is forty pages. Split on blank
 * lines first so a clause stays whole, then pack paragraphs up to MAX_CHARS. Anything still
 * longer than the budget on its own is cut on sentence boundaries.
 */
export function chunkDocument(doc: PropertyDoc): Chunk[] {
  const paragraphs = doc.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const pieces: string[] = [];

  for (const paragraph of paragraphs) {
    for (const unit of splitOversized(paragraph)) {
      const last = pieces[pieces.length - 1];
      if (last && last.length + unit.length + 2 <= MAX_CHARS) {
        pieces[pieces.length - 1] = `${last}\n\n${unit}`;
      } else {
        pieces.push(unit);
      }
    }
  }

  const header = `${doc.kind} · unit ${doc.unit} · ${doc.filed_on}`;
  return pieces.map((text, part) => ({
    id: `${doc.id}#${part}`,
    text: `${header}\n${text}`,
    metadata: { doc_id: doc.id, unit: doc.unit, kind: doc.kind, filed_on: doc.filed_on, part },
  }));
}

function splitOversized(paragraph: string): string[] {
  if (paragraph.length <= MAX_CHARS) return [paragraph];
  const sentences = paragraph.match(/[^.!?]+[.!?]*\s*/g) ?? [paragraph];
  const out: string[] = [];
  let buffer = "";
  for (const sentence of sentences) {
    if (buffer && buffer.length + sentence.length > MAX_CHARS) {
      out.push(buffer.trim());
      buffer = "";
    }
    buffer += sentence;
    while (buffer.length > MAX_CHARS) {
      out.push(buffer.slice(0, MAX_CHARS).trim());
      buffer = buffer.slice(MAX_CHARS);
    }
  }
  if (buffer.trim()) out.push(buffer.trim());
  return out;
}
