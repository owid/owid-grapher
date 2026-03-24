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
2. Components are registered in [site/bespokeComponentRegistry.ts](../site/bespokeComponentRegistry.ts) with URLs to their JS and CSS bundles
3. When an article containing a `{.bespoke-component}` block is rendered, the code:
    - Looks up the bundle in the registry
    - Creates a Shadow DOM container (for CSS isolation)
    - Dynamically imports the JS module and loads the CSS into the shadow root
    - Calls the module's `mount()` function with the container and config

### The `mount` interface

Your ES module must export a `mount` function:

```ts
export function mount(
    container: HTMLDivElement,
    opts: { variant?: string; config?: Record<string, string> }
): void | Promise<void> | Promise<() => void>
```

- **`container`** — A div inside the Shadow DOM into which you render your viz. The div is created for you.
- **`opts.variant`** — Optional string to distinguish multiple instances of the same bundle within an article. Useful for embedding different views (e.g. a map and a chart) that share state.
- **`opts.config`** — Key-value pairs passed from the ArchieML block.
- **Return value** — Optionally return a cleanup/disposal function that will be called on unmount.

### Registering a component

Add your bundle to the registry in [site/bespokeComponentRegistry.ts](../site/bespokeComponentRegistry.ts), e.g. like this:

```ts
export const BESPOKE_COMPONENT_REGISTRY: Record<
    string,
    BespokeComponentDefinition
> = {
    "income-plots": {
        scriptUrl: "/assets/bespoke/income-plots.mjs",
        cssUrl: "/assets/bespoke/income-plots.css",
    },
}
```

## Embedding in Google Docs

Use the `{.bespoke-component}` ArchieML block:

```yaml
{.bespoke-component}
  bundle: income-plots
  variant: distribution
  size: wide # options: narrow, wide, widest
  {.config}
    country: USA
    year: 2020
  {}
{}
```

### Properties

| Property  | Required | Default | Description                                                                                         |
| --------- | -------- | ------- | --------------------------------------------------------------------------------------------------- |
| `bundle`  | Yes      | —       | Name of the component in the registry                                                               |
| `variant` | No       | —       | Identifier for this instance; multiple instances of the same bundle can use variants to share state |
| `size`    | No       | `wide`  | Layout width: `narrow`, `wide`, or `widest`                                                         |
| `config`  | No       | `{}`    | Key-value pairs passed to the mount function. Values must be strings (no nesting).                  |

## Sizing

The **width** of your component is determined by the `size` property in the ArchieML block:

- `narrow` — 6 columns on wide screens
- `wide` — 8 columns (default)
- `widest` — 12 columns

On smaller screens, these map to other grid-based widths. See [site/gdocs/components/layout.ts](../site/gdocs/components/layout.ts) for the exact grid definitions. The **height** is entirely up to you — set it to whatever works for your viz.

Ideally, your component adapts fluidly to any width given by its container. But if you need a `max-width` or a set of "good" widths, that's fine too.

There is currently no mechanism for specifying dimensions ahead of time to prevent layout shifts. Components are rendered at whatever size the container provides once they load, and there will be a layout shift.
We might add a way to specify dimensions for the loading state in the future.

## Shadow DOM considerations

Components run inside a Shadow DOM, which provides full CSS encapsulation but comes with trade-offs:

- Use `:host` instead of `:root` for defining CSS custom properties
- Any portal-based UI (tooltips via `floating-ui`, modals, etc.) must mount elements **inside** the Shadow DOM container, otherwise they won't have access to your styles
- The component has no access to the site's global styles — you need to bundle all your own CSS

## Projects

Each project under `bespoke/projects/` is fully self-contained. A project has its own `package.json`, its own dependencies, and its own build step — there is no shared build pipeline.

This means each project is responsible for:

- Managing its own dependencies (`npm install` / `yarn install` inside the project directory)
- Defining its own build command that produces the `.mjs` and `.css` output files
- Bundling everything it needs — shared site styles, fonts, etc. are not available inside the Shadow DOM

Projects can import shared code from `bespoke/components/` if needed, but must bundle it into their output.

### Build setup

Projects use [Vite library mode](https://vite.dev/guide/build.html#library-mode) to produce the ESM module and CSS file. A minimal `vite.config.ts`:

```ts
import { defineConfig } from "vite"

export default defineConfig({
    build: {
        lib: {
            entry: "src/index.ts",
            formats: ["es"],
            fileName: "bundle",
        },
        outDir: "dist",
    },
})
```

## Sharing state between variants

When multiple `{.bespoke-component}` blocks in an article use the same `bundle`, they share the same JS module — which means they can share state. The `variant` property tells each instance which view to render, while a shared store keeps them in sync.

For example, an article might embed a map and a line chart from the same bundle. When the user selects a country on the map, the line chart updates to show that country's data. This is possible because both instances read from the same store.

### Jotai for shared state

[Jotai](https://jotai.org/) is a lightweight atomic state library for React. It works well here because:

- **Module-level atoms** — You define atoms (small units of state) at the module scope. Since all variants share the same module, they automatically share the same atoms. It's like `useState`, but with the reactive state defined outside of the component, and thereby shareable across all instances.
- **Fine-grained reactivity** — Components only re-render when the specific atoms they subscribe to change, keeping things fast.
- **Minimal boilerplate** — No providers, reducers, or context setup needed.

A basic example:

```ts
// shared state — defined once at module scope, shared across all variants
import { atom } from "jotai"
export const selectedCountryAtom = atom<string>("USA")
```

```tsx
// variant: "map" — writes to the shared atom
import { useAtom } from "jotai"
import { selectedCountryAtom } from "./atoms"

function Map() {
    const [, setCountry] = useAtom(selectedCountryAtom)
    return <WorldMap onSelect={setCountry} />
}
```

```tsx
// variant: "line-chart" — reads from the shared atom
import { useAtomValue } from "jotai"
import { selectedCountryAtom } from "./atoms"

function LineChart() {
    const country = useAtomValue(selectedCountryAtom)
    return <Chart country={country} />
}
```

Your `mount` function then renders the right component based on `opts.variant`:

```ts
export function mount(container, { variant }) {
    const root = createRoot(container)
    if (variant === "map") root.render(<Map />)
    else if (variant === "line-chart") root.render(<LineChart />)
}
```

You don't have to use jotai — any module-scoped state (a plain variable, an event emitter, MobX, etc.) will work since all variants share the same module. Jotai is just a good and easy choice for React projects.

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

Visit `http://localhost:8089/<project>/demo` to see a demo page that mounts all of a project's variants inside Shadow DOM — matching the production embedding behavior.

Append `?shadowDom=false` to disable Shadow DOM isolation. This gives you proper CSS HMR. See [bespoke/server/readme.md](server/readme.md) for more.

## Creating a new bespoke component

1. Create a new directory under `bespoke/projects/`
2. Set up your project with its own `package.json` and build tooling to output an ESM module (`.mjs`) and a CSS file
3. Export a `mount` function from the entry point
4. Register the bundle in [site/bespokeComponentRegistry.ts](../site/bespokeComponentRegistry.ts)
5. Deploy the built assets to the expected URL path
6. Add the `{.bespoke-component}` block in your Google Doc
