# ArchieML component reference — admin screen handoff brief

> **Status:** planning handoff. This document is the starting point for a Claude Code
> session to plan and implement an in-admin browsable reference for our ArchieML gdoc
> components. It captures the goal, a design critique of the prototype, the target UX,
> and a concrete implementation map grounded in our actual admin conventions. Nothing
> here is built yet — treat it as a brief, not a spec to follow literally.

## 1. Goal & context

Authors write our articles in Google Docs using ArchieML components. Their three recurring
pain points are: (1) not knowing **which components exist**, (2) the ArchieML documentation
(currently a single gdoc) is **hard to navigate**, and (3) not knowing the **canonical
structure** for the type of content they're writing.

This screen targets pain points 1 and 2 — the **browsing reference** ("what exists / what's
it called / what does it look like"). It is a read-only, internal admin page that renders the
component registry we already generate in CI.

We chose the admin (a persistent, linkable URL) over an ephemeral Claude session because:
it gives a stable URL that error messages, Slack answers, and onboarding docs can deep-link
into; and the admin is the only place we get **real component renders for free** via the
existing gdoc rendering pipeline.

A visual prototype of the target UX lives next to this file:
`docs/component-reference-admin-mockup.html` (open in a browser). It demonstrates the
gallery → detail flow, the render↔archie pairing, search/filter, usage badges, and
"when to use / when not". The previews in that file are CSS approximations — see §3,
recommendation 1, for why the admin version should render real components instead.

## 2. The asset we're building on

Everything is derived from one CI-maintained artifact — no hand-authored content that can rot:

- **Registry JSON:** `docs/components.registry.generated.json` (65 components today).
- **Generator:** `devTools/gdocs/generate-components-reference.ts`
  (`yarn generateComponentsReference`). Parses the `OwidEnrichedGdocBlock` union via the
  TypeScript AST, reads each component's `.md` sidecar
  (`packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/*.md`), validates every
  example through `archieToEnriched()`, and emits the JSON.
- **CI auto-heal:** the `regenerate-components-reference` job in
  `.github/workflows/format.yml` regenerates the JSON and auto-commits any drift back to the
  branch (including direct edits on master via the GitHub web editor), so the committed JSON
  stays current without anyone running the generator locally.

Per-component shape (`ComponentDoc`):

```ts
type ComponentDoc = {
    id: string // "chart", "side-by-side"  — the {.id} authors type
    title: string // "Chart"
    typeName: string // "EnrichedBlockChart"
    sourceFile: string
    sidecarFile: string
    body: string // markdown: description, When to use / When NOT to use, Variations, notes
    examples: { name: string; archie: string }[] // can be empty
}
```

Note: ~13 of 65 components have **no examples** (e.g. `additional-charts`, `table`, `heading`,
`simple-text`) — some structurally cannot have a standalone archie example. The UI must handle
empty `examples` gracefully (see §3).

## 3. Design critique of the prototype

Critique of the gallery + detail prototype, using the standard framework. Stage: early/refinement.

### Overall impression

The gallery-first layout reads immediately as a browsable catalog, and the render↔archie
pairing with a Copy button is the right atomic unit for authors who ultimately paste ArchieML.
The biggest opportunity is replacing the faked previews with real renders, which the admin
uniquely makes cheap.

### Usability

| Finding                                             | Severity    | Recommendation                                                                                                                                                               |
| --------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Previews are CSS approximations, not real renders   | 🔴 Critical | Render real components via the gdoc pipeline (see priority 1). This is the whole point of "what does it look like".                                                          |
| Prototype only shows components that have examples  | 🔴 Critical | Show all 65. For empty `examples`, render the sidecar `body` (which still has description + when-to-use) and an explanatory empty state instead of a blank code panel.       |
| Search only matches title/id/description            | 🟡 Moderate | Also match `typeName` and `body`; add a `⌘K` shortcut to focus search. Mirror the debounced search pattern in `VariablesIndexPage`.                                          |
| Container components don't reveal what nests inside | 🟡 Moderate | For `side-by-side`, `sticky-left/right`, `key-insights`, `chart-story`, show an "accepts" line listing valid children, linking to their detail. Bridges toward pain point 3. |
| Detail shows only the first example                 | 🟢 Minor    | Tab or stack all named examples, each with its own Copy.                                                                                                                     |

### Visual hierarchy

- **What draws the eye first:** the preview thumbnail, then the title — correct for visual scanning.
- **Reading flow:** category filter → grid → card → detail is a natural drill-down.
- Keep the monospace `{.id}` prominent on each card — it is effectively the component's "API name" and the string authors type.

### Consistency

- The prototype uses Tabler icons, custom pills, and a bespoke input. The admin uses
  **antd + Bootstrap**, **FontAwesome** icons, the **`AdminLayout`** wrapper, and the shared
  **`SearchField`** (`adminSiteClient/Forms.js`). The real screen must adopt these — do not port
  the prototype's styling verbatim.
- Use BEM in a companion `.scss` (see §4) rather than the prototype's inline styles.

### Accessibility

- Severity/when-to-use uses color **plus** icon + label — good; keep text labels, never color alone.
- Ensure visible focus rings on cards and that cards are keyboard-activable (the prototype's
  `tabindex`/Enter handling is the right idea).
- Check contrast on the tertiary monospace text against the card background.

### What works well

- Gallery-first discovery; the render↔archie split; Copy as the primary CTA.
- Usage badges and "seen in N articles" answer "is this blessed or a dead end?".
- Deep-linkable `#component-id` anchors so other surfaces can link in.

### Priority recommendations

1. **Render real components, not approximations.** `archieToEnriched()`
   (`db/model/Gdoc/archieToEnriched.ts`) + the `ArticleBlock` renderer
   (`site/gdocs/components/ArticleBlock.tsx`) already exist. Parse each example's archie to an
   enriched block and render it. Decide where parsing runs (see §5 — `archieToEnriched` sits in
   `db/` and may pull server-only deps; a small admin endpoint that returns enriched JSON is the
   safe path). This single change delivers most of the "what does it look like" value.
2. **Cover all 65 components, including example-less ones**, and render the **full sidecar
   `body` markdown** in the detail view (it carries When-NOT-to-use, Variations, and notes the
   prototype omits).
3. **Adopt the admin design system** (antd/`SearchField`/`AdminLayout`/FontAwesome) and add a
   persistent category sidebar + `⌘K` focus for navigation at 65+ items.

## 4. Implementation map (admin conventions)

Mirror `adminSiteClient/ChartIndexPage.tsx` (simple) and `VariablesIndexPage.tsx` (search/filter).

| Purpose                  | Path                                                                                                  | New? |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ---- |
| Page component           | `adminSiteClient/ComponentsIndexPage.tsx`                                                             | new  |
| Page styles (BEM)        | `adminSiteClient/ComponentsIndexPage.scss`                                                            | new  |
| Style import             | `adminSiteClient/admin.scss` (`@import "./ComponentsIndexPage.scss";`)                                | edit |
| Route                    | `adminSiteClient/AdminApp.tsx` (`<Route exact path="/components" component={ComponentsIndexPage} />`) | edit |
| Sidebar link             | `adminSiteClient/AdminSidebar.tsx` (FontAwesome icon + `<Link to="/components">`)                     | edit |
| API endpoint (if chosen) | `adminSiteServer/apiRoutes/components.ts`                                                             | new  |
| API registration         | `adminSiteServer/apiRouter.ts`                                                                        | edit |

Page skeleton (MobX class component, our nonstandard `makeObservable` setup per CLAUDE.md):

```tsx
@observer
export class ComponentsIndexPage extends Component {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType
    components: ComponentDoc[] = []
    searchInput: string = ""

    constructor(props: Record<string, never>) {
        super(props)
        makeObservable(this, {
            components: observable,
            searchInput: observable,
        })
    }
    // getData() via this.context.admin.getJSON(...), AdminLayout wrapper, etc.
}
```

SCSS blocks (full BEM class names, no `&__` concatenation per CLAUDE.md):

```scss
.components-index-page {
}
.components-index-page__gallery {
}
.components-index-page__card {
}
.components-index-page__card-preview {
}
.components-index-page__detail {
}
```

## 5. Key decisions to resolve during planning

1. **How the client gets the registry.** Options:
    - **(a) Direct JSON import** — `import registry from "../docs/components.registry.generated.json"`.
      Simplest; bundles into the admin build. Check tsconfig `resolveJsonModule` and bundle-size impact.
    - **(b) Admin API endpoint** — `GET /api/components.json` reads the file server-side. Consistent
      with how other admin data loads; required anyway if the endpoint also returns enriched/rendered
      output (see below). **Likely preferred.**
2. **Where archie→enriched parsing runs.** `archieToEnriched` lives in `db/` and may depend on
   server-only modules. Safer to parse server-side in the `/api/components.json` endpoint and return
   enriched blocks alongside each example, so the client only needs `ArticleBlock` to render.
   Verify `ArticleBlock`'s required context/attachments (see `docs/agent-guidelines/gdocs-attachments.md`)
   — examples that reference charts/images may need stubbed or fetched attachments. Charts can fall
   back to existing thumbnail CF functions if live embeds are too heavy for a gallery.
3. **Usage data (optional, high value).** A datasette/SQL pass over `posts_gdocs` content can produce
   per-component usage counts and example article URLs for the badges and "seen in" links. Decide
   whether to include in v1 or defer.
4. **Scope of v1.** Recommend: all 65 components, real renders where attachments allow (thumbnail
   fallback otherwise), full sidecar body, search + category filter, Copy archie, deep-link anchors.
   Defer: usage badges, container "accepts"/anatomy view, `⌘K` palette.

## 6. Suggested phasing

1. **Data path:** add `/api/components.json` (registry + optionally enriched examples); wire route,
   page shell, sidebar link. Render the raw gallery from titles/descriptions.
2. **Detail view:** full sidebar `body` markdown, examples with Copy, deep-link anchors, empty states.
3. **Real renders:** integrate `ArticleBlock` for examples; resolve attachment/context needs; thumbnail
   fallback for chart-bearing components.
4. **Navigation polish:** category sidebar, debounced search across title/id/typeName/body, `⌘K`.
5. **Enhancements (optional):** usage badges from `posts_gdocs`, container "accepts" links.

## 7. Verification

- `yarn typecheck`, `yarn testLintChanged`, `yarn testFormatChanged`.
- Confirm all 65 components list and that example-less components render without a broken panel.
- Spot-check a container (`side-by-side`), a chart component (`chart`), and a media component
  (`image`) render or fall back correctly.
- Confirm Copy yields valid archie (round-trip through `archieToEnriched` without error — the
  generator already validates this, so committed examples should pass).
