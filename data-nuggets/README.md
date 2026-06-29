# Data nuggets — local craft directory

This directory is where the data-nugget pipeline does its local work: investigation reports, generated draft JSON files, and refinement artifacts. After step 5 (`/push-data-nuggets`), the actual content lives in the MySQL `agentic_writing_*` tables and is reviewed in the admin at `/admin/agentic-writing`.

Data nuggets are the first content type in the broader **agentic-writing playground** — a place for OWID staff to experiment with AI-first writing. Other content types (e.g. micro-explainers, side-by-side comparisons) can be added later as separate `contentType` values on the lineage row, with their own pipelines.

> **New here? Start with [GETTING-STARTED.md](./GETTING-STARTED.md)** — prerequisites, one-time auth, generating your first nuggets, and reviewing them. This README is the reference for layout, schema, and the review model.

## Layout

```
data-nuggets/
├── README.md                              (tracked)
├── index.html                             (static prototype browse page)
├── .scratch/                              (gitignored — temp working files)
├── reports/                               (gitignored — HTML investigation reports)
│   └── {key}-{YYYY-MM-DD-HH-MM-SS}.html
├── views/                                 (gitignored — local refined drafts, before push)
│   ├── {key}-{YYYY-MM-DD-HH-MM-SS}.json
│   └── index.json
└── versions/                              (inert — legacy file-backed history; pre-migration)
```

Where `{key}` is either a single chart slug (`child-mortality`) or multiple slugs joined with `+` (`gdp-per-capita-worldbank+oil-production`).

**Storage**: once pushed, lineages + versions live in MySQL (`agentic_writing_lineages` and `agentic_writing_versions`). The `versions/` directory exists only as a historical artifact from the pre-migration file-backed store; nothing reads or writes to it anymore and it can be safely deleted after running `devTools/migrateAgenticWritingToDb.ts`.

Everything except this README and `index.html` is gitignored.

## Surfaces

- **Admin** (`/admin/agentic-writing`) — the My drafts / Editorial queue / Published workspace, behind admin auth. React page in `adminSiteClient/AgenticWritingPage.tsx`; DB-backed API in `adminSiteServer/apiRoutes/agenticWriting.ts` (logic in `adminSiteServer/agenticWritingStore.ts`).

## Review & versioning

Each lineage has a stable `lineageKey` (`{sourceId}__{localId}`) on its row in `agentic_writing_lineages`. Every review decision or content revision appends a row to `agentic_writing_versions`; existing rows are never updated. Version `kind` is `initial` | `decision` | `revision`. Derived **review** state from the latest version: `unreviewed` → (`approved` | `rejected` | `awaiting_revision`); a `revision` with no decision is `awaiting_review`.

A lineage also has an orthogonal **editorial** state on its row (`private` → `submitted` → `published`), set explicitly via `POST /agentic-writing/:lineageKey/{submit,publish}`.

## Pipeline

```
chart slug(s)
   │
   ▼
[1] /investigate-chart           → reports/{key}-{ts}.html         (HTML, opens standalone in a browser)
   │
   ▼
[2] /generate-data-nuggets       → views/{key}-{ts}.json           (status: draft)
   │
   ▼
[3] /fact-check-data-nuggets     → mutates same file in place      (status: fact-checked)
   │
   ▼
[4] /refine-data-nuggets         → mutates same file in place      (status: refined)
   │
   ▼
[5] /push-data-nuggets           → DB (initial versions, editorial: private)
   │
   ▼ (review in admin: approve / request revisions / reject / submit / publish)
```

Each step is a discrete skill — invoke them in order. Steps 1–4 are local craft (files on disk); step 5 bridges to the shared admin DB so the nugget enters the My drafts queue for review and eventual submission/publication.

For the common case, the **`/data-nuggets`** orchestrator skill runs steps 1–5 end to end for one or more chart slugs and deletes the local working JSON after a successful push (the DB becomes the source of truth). Use the discrete skills directly only when you want manual control over a single stage.

## Local JSON schema (data nugget draft file)

```json
{
    "$schemaVersion": 1,
    "inputChartSlugs": ["child-mortality"],
    "generatedAt": "2026-05-22T14:32:00Z",
    "generatedBy": "claude-opus-4-7",
    "status": "draft",
    "views": [
        {
            "id": "view-01",
            "title": "Child mortality has fallen 91% globally since 1800",
            "description": "Two short sentences describing what's shown and what's interesting.",
            "grapherViews": [
                {
                    "slug": "child-mortality",
                    "url": "https://ourworldindata.org/grapher/child-mortality?tab=line&country=OWID_WRL&time=earliest..latest",
                    "queryParams": {
                        "tab": "line",
                        "country": "OWID_WRL",
                        "time": "earliest..latest"
                    },
                    "caption": null
                }
            ],
            "metadata": {
                "grapherSlugs": ["child-mortality"],
                "entities": ["OWID_WRL"],
                "createdAt": "2026-05-22T14:32:00Z",
                "createdBy": "claude-opus-4-7",
                "keyInsightLevel": null,
                "factCheck": null,
                "refinement": null
            }
        }
    ]
}
```

### Key fields

- **`status`** — `draft` → `fact-checked` → `refined`. Bumped by each skill in turn.
- **`views[].grapherViews`** — array, supports 1+ entries. Single-chart nuggets have one entry; multi-chart "collage / carousel" nuggets have multiple, each with a `caption`. When pushed to the DB, this array is wrapped as `payload: { grapherViews: [...] }` on the version row.
- **`views[].grapherViews[].queryParams`** — parsed object. Keys must come from `GRAPHER_QUERY_PARAM_KEYS` in `packages/@ourworldindata/types/src/grapherTypes/GrapherTypes.ts`. See `.claude/skills/_shared/grapher-url-parameters.md` for the field-by-field reference.
- **`views[].metadata.entities`** — focal entity codes the nugget spotlights (`["NER", "SMR"]`, `["OWID_AFR", "OWID_EUR"]`, `["OWID_WRL"]`). A relevance tag; also gates `keyInsightLevel`.
- **`views[].metadata.keyInsightLevel`** — `null` (default), `"notable"`, or `"key"`. `key` is reserved for pure-world state-of-the-world nuggets (entities `["OWID_WRL"]`); a narrow country comparison is never key. Set conservatively.
- **`views[].metadata.factCheck` / `refinement`** — annotation blocks added by their respective steps. Null until that step has run.

## Out of scope (for now)

- No automated scheduling — the `/data-nuggets` orchestrator still runs on demand, one batch of slugs at a time.
- No embedding generation.
- No rendering of these nuggets on the public ourworldindata.org site (only the admin workspace).
- No gdocs export when a nugget graduates into a full article — designed but not implemented.
