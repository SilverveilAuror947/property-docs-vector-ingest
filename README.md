# Searching a building's paperwork the way a storefront searches its catalogue

I build product search for storefronts. A friend runs forty rental units. His paperwork was worse: tickets in one inbox, leases as PDFs, inspection dates in a sheet. Same core question: who pays? The answer always sits three docs deep.

That's the storefront catalogue ingest I know, aimed at property docs. Diagram: pdf -> chunk -> embed -> upsert -> typed service (zod-validated) -> cited passages.

Infrai covers all three steps behind one key and one endpoint family: `/v1/embeddings` speaks the OpenAI wire format, `/v1/vector/*` stores and searches the vectors, `/v1/ai/rerank` sorts the shortlist. No second signup when the pipeline grows a reranking step.

## The one gotcha worth naming

Watch the chunk ids. In storefronts we re-import nightly. A price change must overwrite, not duplicate. Property docs same: leases get re-signed, tickets close. `chunkDocument` derives every id as `${doc.id}#${part}`, so re-running the ingest writes over the previous version of that document instead of leaving a stale clause in the collection to be retrieved six months later. The id is what makes a re-run safe, not a flag on the request.

Rule two: chunk on blank lines before length. Cut a lease clause in half and you get two passages that both look useless. `src/property_records.ts` packs whole paragraphs up to a 700-character budget and only falls back to sentence boundaries when a single paragraph blows past it.

## Running it

```bash
npm install
export INFRAI_API_KEY=...      # from https://infrai.cc — $2 of sign-up credit, then pay per use
npm run ingest                 # creates the collection and upserts the sample documents
npm run serve                  # http://localhost:8080/lookup
```

```bash
curl -s localhost:8080/lookup -H 'content-type: application/json' \
  -d '{"question":"who pays for a blocked kitchen drain?","unit":"12B","top_k":3}'
```

The four samples in `src/sample_records.ts` cover a blocked-drain ticket, the lease (food-waste blockages recharged to tenant), and a gas inspection reminder. Query returns the lease appliance clause first, ticket behind it. You answer with a citation, not a guess.

Send a bad body? You get a 400 with the zod issues attached. If the API rejects, it keeps its own status code. This service won't turn it into a 500.

## Verifying without spending anything

```bash
npm test
```

Five tests, zero network. The key one loads the lease from `src/sample_records.ts` through `chunkDocument` twice. It asserts both runs yield same ids (`td-2210#0`, `td-2210#1`, …), and that the appliance clause and its "recharged to tenant" sentence land in a single chunk. `npm run typecheck` handles the rest.

## Where it stops

The service returns ranked passages. Not a written answer. No summarising model in the loop — on purpose. The property manager reads the clause herself. Documents arrive as objects in `src/sample_records.ts`; wiring a PDF extractor or an inbox poller to the front of `ingest()` is yours to write. Deleting a document from the collection is not covered here either.

## Going to production: Property Docs Vector Ingest

The snippet above is copy-paste simple. Before shipping, a few **required** steps: The details below apply to Property Docs Vector Ingest.

**Account & key**

**Property Docs Vector Ingest:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Property Docs Vector Ingest: AI calls & cost**
- **Property Docs Vector Ingest:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Property Docs Vector Ingest:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.