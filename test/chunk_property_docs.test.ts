import test from "node:test";
import assert from "node:assert/strict";
import { chunkDocument, LookupRequest, type PropertyDoc } from "../src/property_records.ts";
import { SAMPLE_DOCS } from "../src/sample_records.ts";

const lease = SAMPLE_DOCS.find((d) => d.id === "td-2210")!;

test("a short maintenance request stays one chunk and keeps its unit header", () => {
  const request = SAMPLE_DOCS.find((d) => d.id === "mr-4471")!;
  const chunks = chunkDocument(request);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].id, "mr-4471#0");
  assert.match(chunks[0].text, /unit 12B/);
  assert.equal(chunks[0].metadata.kind, "maintenance_request");
});

test("lease clauses are not split mid-clause", () => {
  const chunks = chunkDocument(lease);
  const appliance = chunks.find((c) => c.text.includes("Appliance clause"))!;
  assert.ok(appliance, "appliance clause survives chunking");
  assert.ok(appliance.text.includes("recharged to the tenant"));
});

test("a long document is cut into bounded chunks with sequential ids", () => {
  const long: PropertyDoc = {
    id: "td-9000",
    unit: "7C",
    kind: "tenant_document",
    filed_on: "2026-01-05",
    body: Array.from({ length: 12 }, (_, i) => `Clause ${i}. ${"Occupancy terms apply. ".repeat(12)}`).join("\n\n"),
  };
  const chunks = chunkDocument(long);
  assert.ok(chunks.length > 1);
  chunks.forEach((chunk, i) => {
    assert.equal(chunk.id, `td-9000#${i}`);
    assert.equal(chunk.metadata.part, i);
    assert.ok(chunk.text.length <= 800);
  });
});

test("re-chunking the same document produces the same ids, so a replayed ingest overwrites", () => {
  assert.deepEqual(chunkDocument(lease).map((c) => c.id), chunkDocument(lease).map((c) => c.id));
});

test("the request boundary rejects an empty question and defaults top_k", () => {
  assert.equal(LookupRequest.safeParse({ question: "hi" }).success, false);
  const parsed = LookupRequest.parse({ question: "who pays for a blocked drain in 12B?" });
  assert.equal(parsed.top_k, 5);
});
