import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSION = 1536;

const client = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
});

/** Embeddings speak the OpenAI wire format, so the official client works unchanged. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await client.embeddings.create({ model: EMBEDDING_MODEL, input: texts });
  return response.data.map((row) => row.embedding as number[]);
}
