# Gdoc migrations

## Safety

- **Concurrent-edit race**: every `batchUpdate` carries
  `writeControl.requiredRevisionId` from the same `documents.get` the edits
  were computed against. On failure (author edited in between): re-fetch,
  re-plan that doc, retry once, then flag.
- **Pending suggestions**: if suggestion markers
  (`suggestedInsertionIds`/`suggestedDeletionIds`) overlap a _target block's_
  line ranges, skip the gdoc edit and flag the doc. Block-scoped, not
  doc-scoped — authors use suggesting mode routinely, and a doc-scoped skip
  would flag far too much. (`batchUpdate` cannot apply edits _as_
  suggestions, so there is no gentler option.)
- **Synthetic lines**: if a transform's line diff touches an unpatchable
  line, the engine fails closed — flag, don't patch.
- **Journal**: per-run JSON on disk mapping docId →
  planned/applied/verified/skipped/flagged plus before/after revision IDs.
  Crash-resumable; re-runs are idempotent (transform finds no match → no-op).
- **Snapshots & recovery**: the fetched doc JSON is written to disk before
  any edit. There is no automated rollback for gdoc edits — recovery is
  manual, via the snapshot and Google's native version history. This is a
  deliberate limitation.
- **The WIP guardrail**: the tool must never write _fetched_ doc content into
  `posts_gdocs.content`. DB-side writes are pure transforms of stored
  content; gdoc-side writes are pure transforms of doc content; the two never
  cross. (Otherwise migrating a published doc whose source is mid-rewrite for
  a data update would publish the WIP.) Enforced by an assertion, not just
  convention.
- **Derived state**: the deploy-time DB transform rewrites `content` only —
  `markdown` and `posts_gdocs_components` are regenerated right after deploy
  by the existing `yarn regenerateGdocMarkdown` and
  `yarn reconstructPostsGdocsComponents` scripts, so
  derived tables don't drift. Republishing is neither required nor
  triggered — the site picks up transformed DB content at the deploy bake,
  exactly as historical content migrations did.
- **Rate limiting**: net-new (nothing in the codebase throttles Google API
  calls today). Concurrency cap of ~5 with exponential backoff on 429s; ~200
  docs × 3 calls each (get, batchUpdate, verification get) completes well
  inside the Docs API per-minute write quota.

## Known edge cases

- **Smart chips**: a `url:` value pasted as a `richLink` chip has no text to
  patch; the patcher special-cases it as chip deletion + styled text
  insertion.
- **Link-styled values**: a URL typed as link-styled text arrives in raw
  ArchieML as `<a href="...">…</a>` markup. Value-rewriting helpers normalize
  via the existing `extractUrl` logic so migrations match both forms.
- **Orphaned comments**: a comment anchored to an edited line loses its
  anchor (the range is deleted and re-inserted). Acceptable for property
  renames; the plan report notes which docs have comments near edits.
- **Multi-line values** (`:end` blocks, backported `html:` blocks) diff as
  multiple contiguous lines and patch normally.

## Boundaries

- Transforms operate **within** a matched block or on scalar frontmatter
  keys. Moving content between blocks, editing free paragraph text, and
  touching `refs`/`faqs`/`details` are out of scope.
- No gdoc-side rollback beyond snapshots + version history.
- No admin UI — this is a dev-piloted CLI, expected to run on the prod
  server a few times a year. Any engineer can author a migration (see the
  `create-gdoc-migration` skill); the prod run stays with the CMS
  maintainers.
