---
name: review-agentic-writing
description: Open an "agentic-writing piece" (latest version) via the admin API and walk the user through an approve / reject / request-revisions decision. Decisions, revisions, and reviewer edits are appended as new immutable versions. Companion to the keyboard-driven review UI at /agentic-writing — use this skill for the cases where the user wants conversational help (drafting revision feedback, checking a superlative against the data, comparing against earlier versions).
metadata:
    internal: true
---

# Review Interesting View

Companion to the `/agentic-writing` admin page. The UI handles bulk review; this skill is for nuanced single-view review where the user wants help thinking through a decision — drafting good revision feedback, sweeping the data to check a superlative, comparing v2 against v1, etc.

## How storage works (DB-backed)

Each lineage's complete history lives in MySQL across two tables: `agentic_writing_lineages` (one row per lineage with owner + editorial state) and `agentic_writing_versions` (immutable, append-only). You **never write to the DB directly** — only via the admin API. The API is responsible for the version-id generation, immutability invariants, and atomicity when a single user action writes more than one row (e.g. a reviewer edit-with-decision).

Three version `kind`s:

- `initial` — the bulk-generated v1. `review.decision` is `null`.
- `decision` — copies content from the prior version and fills the `review` block. `review.decision` is one of `"approved" | "rejected" | "request_revisions"`.
- `revision` — new content (title/description/grapherViews edited). `review.decision` reset to `null` so the revised version can itself be reviewed.

Derived review state (used for filtering):

| Latest version               | Status              |
| ---------------------------- | ------------------- |
| `kind=initial`, no decision  | `unreviewed`        |
| `decision=approved`          | `approved`          |
| `decision=rejected`          | `rejected`          |
| `decision=request_revisions` | `awaiting_revision` |
| `kind=revision`, no decision | `awaiting_review`   |

Each lineage also has an orthogonal **editorial state** on the lineage row:
`private` → `submitted` → `published`. Defaults to `private` (owner's workspace).

## Auth (calling the admin API from Claude Code)

The skill needs an admin user identity to write. Configure once and reuse:

```bash
# In a new terminal: generate a personal admin API key (one-time)
yarn tsx --tsconfig tsconfig.tsx.json devTools/createAdminApiKey.ts --userId=<your-user-id>

# Export it for use by skill calls
export OWID_ADMIN_API_KEY="<the-key-it-printed>"
export OWID_ADMIN_BASE="http://localhost:3030/admin/api"
```

In bash calls below, use `-H "Authorization: Bearer $OWID_ADMIN_API_KEY"`.

## Input

Free-text from the user. Possible shapes:

- "review the next unreviewed view" — pick the first lineage with status `unreviewed` (default scope: my private drafts).
- "review the next unreviewed view for {slug}" — filter by chart slug.
- "review {lineageId}" — specific lineage (e.g. `child-mortality-2026-05-22-18-15-00__view-03`).
- "show me the awaiting-revision queue" — list candidates, then drill in.

## Steps

1. **Fetch the candidate(s).**
    - List: `GET $OWID_ADMIN_BASE/agentic-writing.json?owner=me&editorial=private&status=unreviewed` (and `&slug=<slug>` if specified). The response is `{ items: [{ lineageKey, status, editorial, ownerEmail, versionCount, latest: VersionRecord }] }`.
    - Specific lineage: `GET $OWID_ADMIN_BASE/agentic-writing/{lineageKey}` returns `{ lineageKey, status, editorial, ownerEmail, versions: [...] }`.
    - If nothing matches, tell the user and stop.

2. **Present the view.** Show as a tight summary the user can scan in 5–10 seconds:
    - Title (verbatim)
    - Description (verbatim)
    - Chart slugs + the `url` for each grapherView
    - `keyInsightLevel`, prior `factCheck` and `refinement` annotations (if any)
    - For lineages with version history: a one-line summary of each prior version (kind, decision, comment) so the user can see the trajectory

3. **If the user asks for help thinking about the decision**, do that work first before asking for the decision. Common helper tasks:
    - **Verify a superlative** — fetch the relevant CSV from `https://ourworldindata.org/grapher/{slug}.csv?v=1&csvType=full&useColumnShortNames=false` and run the sweep that could disprove the claim. Report findings concretely.
    - **Compare against an earlier version** — read the full history (already returned above) and show the title/description diff and the original `review.comment` that prompted any prior revision.
    - **Draft a revision request** — propose 2–3 sentences of specific, actionable feedback the user can edit.

4. **Use AskUserQuestion to collect the decision.** Offer four options: `Approve`, `Request revisions`, `Reject`, `Skip (no version written)`. If the user already stated their intent in their message, skip this and proceed.

5. **Collect a comment as appropriate.**
    - `request_revisions`: comment is **required**. If none, ask for it explicitly. Offer to draft one if the user wants.
    - `approve` / `reject`: comment is optional but volunteer the option.
    - `skip`: no comment, no write.

6. **POST the decision:**

    ```bash
    curl -sS -X POST "$OWID_ADMIN_BASE/agentic-writing/{lineageKey}/decisions" \
      -H "Authorization: Bearer $OWID_ADMIN_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"decision":"approved","comment":"looks good","parentVersionId":"<latest.versionId>"}'
    ```

    The server fills in `reviewedAt`, `reviewedBy*`, and assigns the new `versionId`. Passing the prior `versionId` as `parentVersionId` guards against a stale read (server returns 409 if the lineage has advanced since you fetched it).

7. **Confirm to the user.** State the decision recorded and the new versionId returned. If the decision was `request_revisions`, hint that the next step is a revision (either by you, via a follow-up skill invocation, or by a human).

## Helper task: writing the revision itself

If the user follows up with "now revise it" or similar after `request_revisions`, do it end-to-end:

- Read the prior version's content + the revision-request comment.
- Re-fetch the underlying CSV(s) and verify every number you want to keep.
- Produce a new title and description that address the request.
- POST to `/agentic-writing/{lineageKey}/revisions` with `{ title, description, payload, metadata?, parentVersionId }`. For a data nugget, `payload` is `{ "grapherViews": [...] }`. The server writes a `revision` version with `review.decision=null`; status becomes `awaiting_review`.

If you want to revise AND record a decision in one shot (e.g. the user wants you to rewrite and request further revisions in one go), use `/edits` instead:

```bash
curl -sS -X POST "$OWID_ADMIN_BASE/agentic-writing/{lineageKey}/edits" \
  -H "Authorization: Bearer $OWID_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"...","description":"...","payload":{"grapherViews":[...]},"metadata":{...},"decision":"request_revisions","comment":"...","parentVersionId":"<latest>"}'
```

The server applies the rewrite as a `revision` and stacks the decision on top atomically.

## Guardrails

- **Never modify history directly in the DB.** Always go through the API; it enforces the immutability contract.
- **Don't approve a view that has unresolved `factCheck` issues with severity `"major"`** without explicitly flagging that to the user first.
- **Don't write a decision for a lineage whose latest version's `kind` is `"decision"`** without confirming with the user — that means the lineage is already in a terminal state and you're stacking on top.
- **Preserve untouched `metadata` keys** (factCheck, grapherSlugs, refinement, …) when posting a revision/edit. Spread the prior `metadata` first; override only the keys you intend to change.

## Editorial transitions

After review:

- The owner can `POST /agentic-writing/{lineageId}/submit` to move it from `private` to `submitted` (editorial queue).
- Any admin user can `POST /agentic-writing/{lineageId}/publish` to publish a submitted lineage. The server requires the latest review decision to be `approved`.

## Where the UI complements this

The `/agentic-writing` admin page is faster for bulk review with keyboard shortcuts (`a`/`r`/`x` for approve/revisions/reject, `e` to edit inline). Use this skill when the conversational help is worth the extra time per view.

The UI also supports **inline reviewer rewrites**: rather than only requesting revisions in prose, a reviewer can edit the title, description, per-chart caption, `keyInsightLevel`, `entities`, and chart URLs directly, then either "Save rewrite" (writes a `revision` → `awaiting_review`) or click Approve/Revisions/Reject, which applies the rewrite and stacks the decision on top in one step (via the `/edits` endpoint).
