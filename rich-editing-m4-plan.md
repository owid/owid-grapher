# Rich editing M4 — AI assistant side panel

Status: planned 2026-07-04. Decisions confirmed by Daniel: per-user browser
API keys for v1 (server proxy later), embed pi-web-ui's ChatPanel, stable
blockIds on ALL top-level blocks, full tool parity with the gdocs extension
in v1.

Prior art: https://github.com/owid/gdocs-chrome-extension (checked out at
`/home/owid/gdocs-chrome-extension`) — a Chrome side-panel agent for the old
Google Docs workflow, built on the pi framework (`@earendil-works/pi-ai`,
`pi-agent-core`, `pi-web-ui`, pinned 0.75.3). We reuse its harness wiring,
tool design, JS sandbox + virtual file system, and system-prompt conventions,
and replace its Google Docs write path (staged diffs + confirmation dialog +
batchUpdate) with immediate edits into the live Yjs-backed editor from M5.

## §0 Core shift: Yjs reconciliation instead of apply-gating

The extension had to stage edits, show a confirmation dialog, write one
atomic revision-guarded `batchUpdate`, then refetch and verify — because
Google Docs is a remote store with no merge semantics. In the rich editor
none of that is needed:

- Tools apply edits **immediately** as ProseMirror transactions on the live
  TipTap editor. The editor is already a Yjs client (M5), so concurrent
  human edits merge via CRDT; the sync server materializes drafts as usual.
- There is **no `apply` tool and no confirmation dialog**. The user watches
  edits land in the canvas and can undo them.
- **Undo**: agent edits are local transactions → captured by the
  collaborative `Y.UndoManager` automatically. We call
  `undoManager.stopCapturing()` before and after each agent edit op so one
  Ctrl+Z reverts exactly one agent operation and agent edits never merge
  into the same undo group as the user's own typing.
- The staged-vs-saved split disappears: `read` always shows the live
  document, including edits the agent just made. (The extension had to warn
  "read shows the saved document until apply".)
- Revision conflicts disappear: there is no targetRevisionId, no
  "document changed too much" error path, no post-apply verify. Validation
  happens at edit time (XHTML parse + enriched-block validation), which is
  where the model can actually self-correct.

Deliberate consequence: a mistaken agent edit is *in* the document until
undone. Mitigations: per-op undo granularity, a brief highlight on
agent-edited blocks (M4f), autosave revisions + the history drawer (M1),
and comments/live cursors so co-editors see changes as they happen.

## §1 Where the agent runs

In the browser, on the rich editor page, as a new right-rail view
("Assistant") next to Comments/Settings/Inspector. The agent shares the
page's TipTap editor instance and its Yjs provider — it *is* the local
client, so its edits flow through the exact same pipeline as keystrokes.

- LLM calls go directly from the browser (pi-ai sets Anthropic's
  `anthropic-dangerous-direct-browser-access` header; OpenAI/Google allow
  CORS). Keys are per-user, stored in IndexedDB via pi-web-ui's
  `ProviderKeysStore` + `ApiKeyPromptDialog` — the exact extension model;
  the team's shared keys are already in 1Password ("Chrome extension OWID
  Ai Editor API keys").
- Later (out of scope for M4): an admin-server proxy with a central key,
  as a pi-ai custom provider; and headless server-side agents joining docs
  as Yjs clients (the M5 test harness already demonstrates the connection
  path).
- Sessions persist per user in IndexedDB (pi-web-ui `SessionsStore`),
  keyed so sessions are scoped per gdoc. Shared/DB-backed sessions are a
  possible follow-up, not v1.

## §2 Document format for the model: semantic XHTML (M4a)

The agent reads and writes the semantic XHTML dialect from owid-grapher PR
#6236 (`<text>`, `<heading level="2">`, `<chart url=.../>`, ...). The branch
`gdoc-xhtml-roundtrip` still exists on origin; the extension vendored that
codec (`enrichedToXhtml.ts` / `xhtmlToEnriched.ts`) and built its component
catalog and system prompt around it, so reusing it keeps almost all prompt
material verbatim.

Plan:
- Port `enrichedToXhtml` / `xhtmlToEnriched` from the `gdoc-xhtml-roundtrip`
  branch into `adminShared/richEditor/xhtml/`, adapted to current types
  (the branch predates recent block types; diff against
  `packages/@ourworldindata/types` and the extension's vendored copy, which
  is newer than the branch in places).
- Round-trip verification against the same 1,173-published-doc corpus used
  for the PM serialization (extend `devTools/richEditor/roundtripReport.ts`
  or add a sibling report): enriched → xhtml → enriched must be identical
  under `normalizeForComparison`.
- Blocks the XHTML codec can't round-trip (if any remain) are readable but
  rejected for writes with a clear reason — same pattern as the extension's
  read-only blocks.

Translation chain for edits: model XHTML → `xhtmlToEnrichedBlocks` →
existing `enrichedBlockToPmNode` → PM transaction. Reads: PM slice →
`pmNodeToEnrichedBlock` → `enrichedToXhtml`.

## §3 Block identity on all blocks (M4b)

Today only "identified" node types (chart, image, callout, ...) carry
`blockId`. The agent must address *every* top-level block, and positional
addressing is unsafe while a human types concurrently. Change:

- Extend the `OwidBlockIdentity` global attribute + `BlockIdAssignment`
  appendTransaction plugin to all top-level block nodes (paragraph, heading,
  lists, etc.), not just `identifiedNodeNames`. Ids remain draft-only:
  `stripBlockIds` / `withoutBlockIds` already strip them from
  `posts_gdocs.content` on save/publish.
- `pmJson.ts` / serialization: `id` round-trips on all enriched blocks in
  drafts (the `EnrichedBlockWithParseErrors.id?` field already exists).
- Comments: block-anchored threads now work on paragraphs too — no schema
  change needed (`anchorBlockId` is already VARCHAR(32)).
- SelectionRef: text refs get a non-null `blockId` for any containing block,
  improving orphan detection.
- Verify: corpus round-trip unchanged (ids never reach published content);
  editor smoke test that typing/splitting paragraphs assigns/regenerates ids
  correctly (keepOnSplit false, duplicate regeneration already handled).

## §4 Panel shell (M4c)

- Dependencies: `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`,
  `@earendil-works/pi-web-ui` (+ `lit`, `@mariozechner/mini-lit`, `typebox`,
  `arquero`, `defuddle`, `linkedom` as needed), pinned 0.75.3 like the
  extension.
- `adminSiteClient/richEditor/assistant/` package:
  - `AssistantPanel.tsx` — React wrapper that mounts the Lit `ChatPanel`
    (custom element) and owns the `Agent` lifecycle, following the
    extension's `main.ts`: `createAgent` with system prompt + tools factory,
    `agent.subscribe` for session autosave, model/thinking-level memory,
    session list dialog, new-session reset.
  - Storage: `IndexedDBStorageBackend` with `SettingsStore`,
    `ProviderKeysStore`, `SessionsStore`, `CustomProvidersStore` (db name
    `owid-rich-editor-assistant`); session metadata records the gdocId so
    the session list is filtered per document.
  - Tool renderers registered like the extension's `tool-renderers.ts`
    (label + one-line params + plain-text output).
- CSS: import `@earendil-works/pi-web-ui/app.css` scoped to the panel. Risk:
  it's global-ish; plan A is wrapping the panel subtree and prefixing the
  stylesheet at build time (postcss `prefix-selector` in the vite admin
  build); plan B (fallback) render the ChatPanel inside a shadow root with
  the stylesheet adopted into it. Budget a day for this fight; if both fail,
  escalate before rebuilding UI in React.
- Feature flag: same `FEATURE_FLAGS=RichEditor` gate; panel only on native
  docs with sync enabled (the tools require the live Yjs editor).

## §5 Doc tools (M4d)

Ported from `packages/agent/src/tools.ts`, operating on a `ToolHost` that
wraps the live editor instead of a fetched workspace:

```ts
interface RichEditorToolHost {
  editor: Editor                      // live TipTap editor (Yjs-bound)
  gdoc: { id, type, title, ... }      // current doc metadata + settings
  admin: Admin                        // authed admin API client
  getSelectionRef(): RichEditorSelectionRef
  undoBoundary(): void                // UndoManager.stopCapturing()
  code?: CodeHost
  web?: WebHost
  summarizer?: Summarizer
}
```

- `outline` (replaces `open_doc` for the live doc): title, doc type,
  settings summary, comment count, heading outline with block ids and
  section sizes. Reference mode: `outline`/`read`/`find` accept a `doc_id`
  or slug for ANY gdoc (native or Google-authored) fetched read-only via
  the admin API and rendered to XHTML — the "reference doc" pattern from
  the extension, materialized under `/docs/<id>/` in the VFS.
- `read`: by block ids, heading section, or full (with the extension's
  size guidance); output is semantic XHTML with `id` attributes.
- `find`: plain/regex search over the live doc, returns block ids +
  context.
- `edit`: `replace` / `insert_after` / `delete` addressed by block id
  (`after: "start"` supported). Content = semantic XHTML. Pipeline:
  parse (errors → tool error → model self-corrects) → enriched validation
  → PM nodes → locate target blocks by id in the current doc (stale id →
  clear error naming the surviving ids) → one transaction, wrapped in undo
  boundaries. Returns a one-line summary of what changed. New blocks get
  fresh blockIds via the existing assignment plugin; the response reports
  the new ids so the agent can chain edits.
- `get_selection`: `selectionRefFromEditor` — block refs (id + type), text
  refs (Yjs relative positions + excerpt + containing block id), document.
  Additionally the panel auto-attaches the current SelectionRef as context
  to each user message ("the user has selected ..."), so "fix this" works
  without a tool call.
- `list_comments`: comment threads from the API with anchors resolved
  through the editor (orphaned marked).
- `update_settings`: optional small tool to edit frontmatter-ish settings
  (title, excerpt, authors...) through the existing settings save path
  (force-LWW). Read side is part of `outline`.
- `describe_component` / `describe_frontmatter`: port `catalog.ts`,
  `componentDescriptions.ts`, `componentExamples.ts` from the extension's
  archieml-codec, keyed to the XHTML forms; "in this document" instances
  resolved from the live doc. Usage counts can later be computed live from
  our DB (the extension baked them).
- `search_charts` (new): search charts by slug/title/id via the same
  endpoint the M3 chart picker uses; returns slug, title, chart type,
  variables — so "insert a chart about X" resolves to a real
  `<chart url=.../>`.
- System prompt: adapt the extension's `SYSTEM_PROMPT` (same OWID
  copy-editor voice and orientation workflow; drop gdml/sids/apply/ArchieML
  sections; describe blocks/ids/immediate-edits/undo instead). Lives as a
  constant in `adminSiteClient/richEditor/assistant/prompts.ts` for v1;
  runtime-editable prompt (settings row or native fragment doc) is a
  follow-up.

## §6 Code tools, VFS, web, summaries (M4e)

- `createLocalCodeHost` ports nearly unchanged (in-memory FS, AsyncFunction
  sandbox with `fs`/`fetch`/`aq`/`console`, timeout race, SSRF guard). Keep
  the extension's dynamic-import allowance (esm.sh + owid.mjs) — it runs in
  a page context here, so imports work the same.
- `code_*` tools verbatim: list/read/write/fetch/materialize/run, numbered
  `/runs/` + `/runs/latest/` artifacts.
- Materialization: `/doc/current.xhtml` (live doc as semantic XHTML),
  `/doc/comments.json`, `/doc/meta.json`, refreshed on workspace change
  (debounced — the live doc changes constantly under collaboration; refresh
  on tool-call boundaries, not on every keystroke).
- Whole-file staging: `stageWorkspaceFromCode` analogue — if the agent
  rewrote `/doc/current.xhtml`, a `write_doc_file_edits` step diffs it
  against the live doc **by block id** and applies the delta as normal
  edit ops (id-preserving blocks keep comments/anchors). Exposed as part of
  `edit` (`from: "file"`) or a dedicated tool; decide during implementation.
- VFS inspector: port the `VfsView` idea as a small React tree+preview
  under the Assistant tab (or a collapsible section) so users can see
  `/runs`, `/scripts`, `/docs`.
- `web_search` / `read_url`: port `web.ts` (Gemini grounding backend +
  defuddle extraction). Uses the user's Google key from the same key store.
  The read_url fetch needs a CORS path: browser pages (unlike MV3 panels)
  can't fetch arbitrary origins — route it through a small authed admin
  proxy endpoint (`GET /admin/api/assistant/fetchUrl?url=...`) with the
  extension's SSRF guard server-side. This is the one part of v1 that
  touches the server.
- `summaries`: port `summaries.ts` (cheap-model per-block notes,
  content-hash cache in localStorage/IndexedDB, overview prompt). Model
  candidates and per-session usage accounting as in the extension.
- Bundled skills: port the mechanism if trivial (a `skill` tool reading
  bundled markdown); otherwise defer — the prompt-doc skill system is
  gdocs-specific and out of scope.

## §7 Slicing and exit criteria

- **M4a** — XHTML codec resurrected in `adminShared/richEditor/xhtml/`;
  corpus round-trip report ≥ target (goal: 1,173/1,173 given current types).
- **M4b** — blockIds on all top-level blocks; corpus round-trip unchanged;
  id-assignment editor tests; comments on paragraphs work.
- **M4c** — Assistant rail view with ChatPanel embedded; keys/model/session
  management working; plain chat (no tools) streams.
- **M4d** — doc tools + system prompt; agent performs: orient via outline
  → find → read → targeted edit landing live in the canvas → visible to a
  second browser via Yjs → single Ctrl+Z reverts it.
- **M4e** — code/VFS/web/summaries tools; fetchUrl proxy endpoint + db test.
- **M4f** — polish: undo boundaries verified under concurrent typing,
  agent-edit highlight, per-doc session scoping, two-browser + agent
  end-to-end script (agent edits while a human types in the same paragraph
  region; no lost keystrokes; materialized draft correct).

Each slice = one commit on a `rich-editing-m4` branch stacked on M5, with
typecheck/lint/unit/db tests + the relevant verification script.

## §8 Risks / open points

- **pi-web-ui CSS in the admin**: main integration risk; plan A prefix
  scoping, plan B shadow-root adoption (§4).
- **XHTML codec drift**: PR #6236 predates newer block types; the
  extension's vendored copy is the more current reference. Corpus report
  is the arbiter.
- **Concurrent-edit races in `edit`**: between reading ids and dispatching
  the transaction the doc can change (same client thread, so within one
  tool call it's atomic; but between tool calls ids can vanish). Stale-id
  errors + re-read guidance in the prompt cover this.
- **Live doc churn vs VFS materialization**: debounce + refresh at tool
  boundaries; `/doc/current.xhtml` staging diffs by block id so a
  concurrently-edited untouched block is never clobbered.
- **Browser-key security posture**: keys in IndexedDB on admin machines,
  same as the extension today; acceptable for v1, proxy later.
- **Prompt-injection via web content**: keep the extension's UNTRUSTED
  framing verbatim; edits are undoable and visible, and there is no
  destructive tool surface (no delete-doc, no publish tool in v1 —
  publishing stays a human button).
