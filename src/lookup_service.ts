import { createServer } from "node:http";
import { callInfrai, InfraiError } from "./infrai_client.ts";
import { embedTexts } from "./embed_text.ts";
import { LookupRequest } from "./property_records.ts";
import { COLLECTION } from "./ingest_property_docs.ts";

type Match = { id: string; score: number; metadata?: Record<string, unknown> };

export type Answer = {
  question: string;
  passages: { id: string; unit: string; kind: string; filed_on: string; text: string; score: number }[];
};

export async function lookup(request: LookupRequest): Promise<Answer> {
  const [embedding] = await embedTexts([request.question]);

  const filter: Record<string, unknown> = {};
  if (request.unit) filter.unit = request.unit;
  if (request.kind) filter.kind = request.kind;

  const queried = await callInfrai<{ matches?: Match[]; results?: Match[] }>("/v1/vector/query", {
    collection: COLLECTION,
    embedding,
    top_k: Math.max(request.top_k * 3, 10),
    filter,
    include_metadata: true,
  });
  const matches = queried.matches ?? queried.results ?? [];
  if (matches.length === 0) return { question: request.question, passages: [] };

  // Nearest-neighbour order puts the lease boilerplate next to the answer; the reranker
  // reads the question and the passage together and sorts on that.
  const candidates = matches.map((m) => String(m.metadata?.text ?? ""));
  const ranked = await callInfrai<{ results: { index: number; score: number }[] }>("/v1/ai/rerank", {
    query: request.question,
    candidates,
    top_k: request.top_k,
    model: "auto",
  });

  return {
    question: request.question,
    passages: ranked.results.map(({ index, score }) => {
      const match = matches[index];
      const metadata = match.metadata ?? {};
      return {
        id: match.id,
        unit: String(metadata.unit ?? ""),
        kind: String(metadata.kind ?? ""),
        filed_on: String(metadata.filed_on ?? ""),
        text: String(metadata.text ?? ""),
        score,
      };
    }),
  };
}

const server = createServer(async (req, res) => {
  const send = (status: number, payload: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload, null, 2));
  };

  if (req.method !== "POST" || req.url !== "/lookup") return send(404, { error: "POST /lookup" });

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  const parsed = LookupRequest.safeParse(safeJson(Buffer.concat(chunks).toString("utf8")));
  if (!parsed.success) return send(400, { error: "invalid body", issues: parsed.error.issues });

  try {
    send(200, await lookup(parsed.data));
  } catch (error) {
    if (error instanceof InfraiError) {
      // A rejected argument is the caller's problem to fix, so it stays a 4xx here too.
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return send(status, { error: error.code, message: error.message });
    }
    send(500, { error: "INTERNAL" });
  }
});

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const port = Number(process.env.PORT ?? 8080);
server.listen(port, () => console.log(`property doc lookup listening on http://localhost:${port}/lookup`));
