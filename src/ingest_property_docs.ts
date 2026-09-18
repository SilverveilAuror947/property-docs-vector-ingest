import { callInfrai } from "./infrai_client.ts";
import { EMBEDDING_DIMENSION, embedTexts } from "./embed_text.ts";
import { chunkDocument, PropertyDoc, type Chunk } from "./property_records.ts";
import { SAMPLE_DOCS } from "./sample_records.ts";

export const COLLECTION = process.env.PROPERTY_COLLECTION ?? "property-docs";

const BATCH = 32;

export async function ensureCollection(): Promise<void> {
  await callInfrai("/v1/vector/collection/create", {
    collection: COLLECTION,
    dimension: EMBEDDING_DIMENSION,
    metric: "cosine",
    metadata: { owner: "property-ops", contents: "maintenance, leases, inspections" },
  });
}

export async function ingest(docs: PropertyDoc[]): Promise<number> {
  const chunks: Chunk[] = docs.flatMap((doc) => chunkDocument(PropertyDoc.parse(doc)));

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const embeddings = await embedTexts(batch.map((c) => c.text));
    await callInfrai("/v1/vector/upsert", {
      collection: COLLECTION,
      vectors: batch.map((chunk, j) => ({
        id: chunk.id,
        embedding: embeddings[j],
        metadata: { ...chunk.metadata, text: chunk.text },
      })),
    });
    console.log(`upserted ${batch.length} chunks (${i + batch.length}/${chunks.length})`);
  }
  return chunks.length;
}

if (process.argv[1]?.endsWith("ingest_property_docs.ts")) {
  await ensureCollection();
  const count = await ingest(SAMPLE_DOCS);
  console.log(`collection ${COLLECTION} now holds ${count} chunks from ${SAMPLE_DOCS.length} documents`);
}
