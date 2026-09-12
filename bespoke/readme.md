# Bespoke Data Viz

Bespoke data viz components are self-contained, independently built visualizations that can be embedded into OWID articles.

Unlike Grapher charts, bespoke components are fully custom — they have their own self-contained JS and CSS, are loaded dynamically, and run inside a Shadow DOM for style isolation.

## Directory structure

```
bespoke/
├── components/    # Shared component library (React components, hooks, utilities)
├── projects/      # Individual bespoke viz projects (each fully self-contained)
├── server/        # Dev server (reverse proxy that lazily starts Vite per project)
├── shared/        # Shared code between the site code and bespoke projects (e.g. shared types, Shadow DOM utilities)
└── readme.md
```

## How it works

1. Each bespoke component is an ES module that exports a `mount` function
2. Components are registered in [site/bespokeComponentRegistry.ts](../site/bespokeComponentRegistry.ts) with the URL of that module
3. When a `{.bespoke-component}` block comes within 400px of the viewport, the code:
    - Looks up the bundle in the registry
    - Creates a Shadow DOM container (for CSS isolation)
    - Dynamically imports the JS module, which carries its own styles inlined
    - Calls the module's `mount()` function with the container and config

Mounting is lazy and happens once: a component far down a long article never loads for a reader who doesn't scroll to it.

### The `mount` interface

Your ES module must export a `mount` function:

```ts
export function mount(
    container: HTMLDivElement,
    opts: { variant?: string; config?: Record<string, string> }
): void | (() => void) | Promise<void | (() => void)>
```

- **`container`** — A div inside the Shadow DOM into which you render your viz. The div is created for you.
- **`opts.variant`** — Optional string to distinguish multiple instances of the same bundle within an article. Useful for embedding different views (e.g. a map and a chart) that share state.
- **`opts.config`** — Key-value pairs passed from the ArchieML block.
- **Return value** — Optionally return a cleanup/disposal function that will be called on unmount.

A module may also export `VARIANTS`, a list of `{ name, demoConfig?, demoSize? }` entries. The site ignores it; the dev server's demo page reads it to mount every variant, and shows an error instead of the component when it is missing.

### Registering a component

Add your bundle to the registry in [site/bespokeComponentRegistry.ts](../site/bespokeComponentRegistry.ts), e.g. like this:

```ts
export const BESPOKE_COMPONENT_REGISTRY: Record<
    string,
    BespokeComponentDefinition
> = {
    "income-plots": {
        scriptUrl: "/income-plots/index.js",
        metadataUrl:
            "https://owid-public.owid.io/bespoke/income-plots.bespoke-metadata.json",
    },
}
```

`scriptUrl` is resolved against `BESPOKE_BASE_URL` (defaults to the local dev server, `http://localhost:8089`). `metadataUrl` is optional and absolute. A featured viz page fetches it at bake time, validates it against `BespokeMetadataSchema`, and renders the methods-and-sources box under the band from it; a bundle with no metadata file leaves it out.

A bundle carries its own styles. `vite-plugin-css-position` inlines them into the ES module so they land inside the shadow root.

## Embedding in Google Docs

Use the `{.bespoke-component}` ArchieML block:

```yaml
{.bespoke-component}
  bundle: income-plots
  variant: distribution
  size: wide # options: narrow, wide, widest
  fallbackImageFilename: income-distribution.png
  {.config}
    country: USA
    year: 2020
  {}
{}
```

### Properties

| Property                | Required | Default | Description                                                                                         |
| ----------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------- |
| `bundle`                | Yes      | —       | Name of the component in the registry                                                               |
| `variant`               | No       | —       | Identifier for this instance; multiple instances of the same bundle can use variants to share state |
| `size`                  | No       | `wide`  | Layout width: `narrow`, `wide`, or `widest`                                                         |
| `config`                | No       | `{}`    | Key-value pairs passed to the mount function. Values must be strings (no nesting).                  |
| `fallbackImageFilename` | No       | —       | Image shown in the component's place when JavaScript is unavailable                                 |

### Rendering without JavaScript

A bespoke component is client-side JavaScript, so it renders nothing for a
reader who doesn't have it. Set `fallbackImageFilename` to an image uploaded
through the admin and that image takes the component's place. It never renders
when JavaScript is available.

The `defaultAlt` on the admin image row is the only description such a reader
gets. The admin raises an error when no image matches the filename, and a
warning when the matching image has no alt text.

Without a fallback image the block shows the site's "JavaScript needs to be
enabled" notice instead. For one figure among many in an article that is a fine
outcome. A featured viz page is nothing but its viz, so the admin warns when the
featured viz has no fallback image.

### Embedding in a key insight

A key insight slide normally takes an image (`filename`), a grapher/explorer chart (`url`) or a narrative chart (`narrativeChartName`). To put a bespoke component in the asset column instead, use the `[.+asset]` array, which accepts any block:

```yaml
{.key-insights}
  heading: Key insights
  [.insights]
    title: Most children die from preventable causes
    [.+asset]
      {.bespoke-component}
        bundle: causes-of-death
        variant: treemap
        {.config}
          ageGroup: Children under 5
        {}
      {}
    []
    [.+content]
      Text of the insight goes here.
    []
  []
{}
```

`asset` is mutually exclusive with `filename`, `url` and `narrativeChartName` — specify exactly one.

The asset column holds one visual filling one slot, so it accepts `bespoke-component`, `chart`, `narrative-chart`, `image`, `static-viz`, `video` and `html`. Layout containers (`side-by-side`, `sticky-left`, `sticky-right`, …) are rejected with a parse error: their grid classes are written for the full 12-column page grid, and the asset column is 7 of those columns, so they would lay out wrong rather than fail. The list is `KEY_INSIGHT_ASSET_BLOCK_TYPES` in `db/model/Gdoc/rawToEnriched.ts`.

Two things to know when authoring one of these:

- **The `size` property has no effect inside a key insight.** The asset column already sets the width (7 of 12 columns on desktop, full width on mobile), and the component fills it.
- **Don't turn on URL syncing.** The key insights block writes the active slide to the `?insight=` query param; a component that also syncs its state to the URL will fight it.

Note that every slide of a key insights block is in the DOM from page load, not just the active one — so a bespoke component in slide 3 mounts and fetches its data even if the reader never opens that slide.

## Featured viz pages

A bespoke component can also be the subject of its own page, rather than one
figure inside an article. Those are gdocs of type `featured-viz`, published at
`/featured-viz/<slug>`, and they behave differently in three ways:

- **The first top-level `{.bespoke-component}` block is the featured viz.** It
  renders on a full-bleed blue band, at the width its `size` asks for. Later
  bespoke blocks on the page render as ordinary blocks.
- **The featured viz drives the URL.** The page forces `urlSync` on for it, so
  the page URL is shareable at a particular view. Every bundle syncs without
  code of its own, because `useUrlState` takes the flag from the embed config.
  There is no opt-out: a featured viz page whose URL doesn't track its viz is
  not worth publishing.
- **The featured viz's metadata is already on the page.** The page renders the
  methods-and-sources box under the band, built from the same metadata file the
  viz would show in its modal. So it forces `hideMetadataModal` on for the
  featured viz, and `BespokeMetadataProvider` drops the footer's "Learn more
  about this data" link along with the modal behind it. Later bespoke blocks
  keep theirs.

Everything else on the page is authored as in a normal article, and any block an
article supports works there.

### More than one bespoke block

Expected, and fine. A page often embeds the same viz several times with
different settings and talks about each one. Only the first top-level bespoke
block is the featured viz: the rest render as ordinary figures, with no blue
band, no `urlSync`, and their metadata modal left in place.

Keeping `urlSync` on the featured viz alone is deliberate. The page URL stands
for the featured viz's state, the thing a reader shares. So a second component
writing its own params would pollute it, and a second component of the _same_
bundle would fight it for the same keys. The cross-instance state sharing
described under "Sharing state between variants" is an in-article device; it
doesn't apply here.

## Sizing

The **width** of your component is determined by the `size` property in the ArchieML block:

- `narrow` — 6 columns on wide screens
- `wide` — 8 columns (default)
- `widest` — 12 columns

On smaller screens, these map to other grid-based widths. See [site/gdocs/components/layout.ts](../site/gdocs/components/layout.ts) for the exact grid definitions. The **height** is entirely up to you — set it to whatever works for your viz.

Ideally, your component adapts fluidly to any width given by its container. But if you need a `max-width` or a set of "good" widths, that's fine too.

## Shadow DOM considerations

Components run inside a Shadow DOM, which provides full CSS encapsulation but comes with trade-offs:

- Use `:host` instead of `:root` for defining CSS custom properties
- Any portal-based UI (tooltips via `floating-ui`, modals, etc.) must mount elements **inside** the Shadow DOM container, otherwise they won't have access to your styles
- The component has no access to the site's global styles — you need to bundle all your own CSS

### CSS injection with `vite-plugin-css-position`

Vite injects CSS into the document `<head>` by default, which never reaches a Shadow DOM. [`vite-plugin-css-position`](https://www.npmjs.com/package/vite-plugin-css-position) redirects it to a `<StylesTarget />` you render in the component tree — CSS HMR in development, styles inlined into the JS output for production. `example` has both halves wired up, in `vite.config.ts` and `src/index.tsx`.

## Projects

Each project under `bespoke/projects/` is fully self-contained. A project has its own `package.json`, its own dependencies, and its own build step. For deployment, [buildBespokeProjects.sh](buildBespokeProjects.sh) runs every project's build and collects the outputs into `dist/assets-bespoke/<name>/` at the repo root.

So each project manages its own dependencies (projects are yarn workspaces of `bespoke/` — run `yarn install` from there) and defines its own build command producing the ES-module output. Shared code from `bespoke/components/` is bundled into that output like any other import.

### Build setup

Projects use [Vite library mode](https://vite.dev/guide/build.html#library-mode) to produce the ESM module. Copy `example/vite.config.ts` rather than writing one: it wires up the CSS injection described above, the shared `DEDUPED_PACKAGES` list, and the entrypoints the dev server reads out of `package.json`.

## Sharing state between variants

When multiple `{.bespoke-component}` blocks in an article use the same `bundle`, they share the same JS module — which means they can share state. The `variant` property tells each instance which view to render, while a shared store keeps them in sync.

For example, an article might embed a map and a line chart from the same bundle. When the user selects a country on the map, the line chart updates to show that country's data. This is possible because both instances read from the same store.

### Jotai for shared state

We use [Jotai](https://jotai.org/). Atoms defined at module scope are shared by every variant of the bundle with no provider or context setup:

```ts
// atoms.ts — one instance, shared by every variant
import { atom } from "jotai"
export const selectedCountryAtom = atom<string>("USA")
```

One variant writes it with `useAtom`, another reads it with `useAtomValue`. `example` does exactly that across `src/core/atoms.ts`, `Picker.tsx` and `Display.tsx`.

Any module-scoped state works — a plain variable, an event emitter, MobX — since all variants share the module. Jotai is just the easy choice for React.

## Shared types

The types for the module interface (`BespokeComponentModule`, `BespokeComponentMountFn`, `BespokeComponentVariantsList`) live in [bespoke/shared/bespokeComponentTypes.ts](shared/bespokeComponentTypes.ts). Projects import them via a TS path alias:

```ts
import type { BespokeComponentMountFn } from "owid-bespoke-types"
```

This requires a `paths` entry in the project's `tsconfig.json` — see [bespoke/shared/readme.md](shared/readme.md) for details.

## Dev server

A dev server at [bespoke/server/](server/) provides a local environment for working on bespoke projects. It lazily spawns a Vite dev server per project and proxies requests, so you get HMR out of the box.

```bash
yarn startBespokeDevServer
```

Visit `http://localhost:8089/<project>/demo` to see a demo page that mounts all of a project's variants inside Shadow DOM — matching the production embedding behavior. `http://localhost:8089/__all` stacks every project's demo page below each other (except `example`), for comparing across projects.

Pass `--build` to build each project and serve the production output via `vite preview` instead of `vite dev`:

```bash
yarn startBespokeDevServer --build
```

### `dev-only-global-css`

Some UI elements — like portaled react-aria overlays (dropdown menus, popovers) — render outside the Shadow DOM and need styles in the global document scope. On the real site these styles are available globally, but the demo page doesn't have them.

To fix this, add a `dev-only-global-css` entrypoint to your project's `package.json`:

```json
{
    "entrypoints": {
        "js": "src/index.tsx",
        "dev-only-global-css": "src/dev-only-global-css.css"
    }
}
```

The dev server will inject this stylesheet into the demo page's `<head>` (outside the Shadow DOM). It is only used during development and is not included in the production build.

## Creating a new bespoke component

1. Copy `bespoke/projects/example/`, rename it, and run `yarn install` from `bespoke/`
2. Register the bundle in [site/bespokeComponentRegistry.ts](../site/bespokeComponentRegistry.ts)
3. Add the `{.bespoke-component}` block in your Google Doc
