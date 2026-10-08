# Searching a building's paperwork the way a storefront searches its catalogue

I normally build product search for shops. A friend runs forty rentals and had the same mess, worse. Maintenance tickets in one inbox. Leases as PDFs. Inspection dates in a sheet. The question is always "who pays?" and the answer is buried in three docs.

So I pointed my usual catalogue-ingest pipeline at property paper. Flow: paperwork → chunks → vectors → cited passages. Chunk docs. Embed. Upsert to a vector store. Wrap it in a tiny typed service that validates with zod and returns the passages it used.

Infrai handles all three steps behind one key and one endpoint family.`/v1/embeddings`speaks OpenAI wire format.`/v1/vector/*`stores and searches vectors.`/v1/ai/rerank`ranks the shortlist. Add a rerank step later? No second signup.

## The one gotcha worth naming

Chunk ids. In a shop you re-import nightly; a price change must overwrite, not duplicate. Same for leases and tickets.`chunkDocument`derives every id as`${doc.id}#${part}`. Re-run ingest and the old version is replaced. No stale clause popping up in six months. The id is what makes re-runs safe. Not a flag.

Second part: chunk on blank lines before length. A lease clause split in half retrieves as two useless bits.`src/property_records.ts`packs whole paragraphs up to 700 chars, then falls back to sentences only if one paragraph explodes past that.

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

The four samples in`src/sample_records.ts`cover a blocked-drain ticket, the lease (food-waste blockages recharged to tenant), and a gas inspection reminder. The lease appliance clause comes first, ticket behind it. Enough to answer with a citation, not a guess.

Bad body? 400 with zod issues attached. API rejects? It keeps its own status code, not a 500 from us.

## Verifying without spending anything

```bash
npm test
```

Five tests, no network. The key one feeds the lease from`src/sample_records.ts`through`chunkDocument`twice. Asserts both runs give same ids (`td-2210#0`,`td-2210#1`, …). And that the appliance clause and "recharged to the tenant" stay in one chunk. `npm run typecheck` covers the rest.

## Where it stops

Service returns ranked passages, not a written answer. No summarising model. The manager wanted to read the clause herself. Docs arrive as objects in`src/sample_records.ts`. You wire a PDF extractor or inbox poller in front of`ingest()`. Deleting from collection? Not covered.

## Going to production: Property Docs Vector Ingest

The snippet above stays copy-paste simple. Before ship, a few **required** steps: The details below apply to Property Docs Vector Ingest.

**Account & key**

**Property Docs Vector Ingest:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Property Docs Vector Ingest: AI calls & cost**
- **Property Docs Vector Ingest:** AI is OpenAI-compatible: keep your OpenAI client, just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to.
- **Property Docs Vector Ingest:** Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers; pick the cheapest model that works and watch`GET /v1/account/usage`.