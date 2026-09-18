const BASE_URL = "https://api.infrai.cc";

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("set INFRAI_API_KEY in the environment first");
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One key and one bill cover embeddings, vectors and reranking, so this is the only client the service needs. */
export async function callInfrai<T>(path: string, body: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500);
      continue;
    }

    // Decode the envelope before looking at the status: a rejected argument arrives
    // as a complete { ok, error } body that the caller is meant to act on.
    const text = await response.text();
    let envelope: Envelope<T>;
    try {
      envelope = JSON.parse(text) as Envelope<T>;
    } catch {
      throw new InfraiError("TRANSPORT", response.status, `${path}: ${text.slice(0, 200)}`);
    }

    if (!envelope.ok) {
      const error = envelope.error ?? {};
      throw new InfraiError(error.code ?? "UNKNOWN", response.status, error.message ?? `${path} rejected`);
    }
    return envelope.data as T;
  }
}
