# Bespoke Data Viz

Bespoke data viz components are self-contained, independently built visualizations that can be embedded into OWID articles.

Unlike Grapher charts, bespoke components are fully custom — they have their own self-contained JS and CSS, are loaded dynamically, and run inside a Shadow DOM for style isolation.

## Directory structure

```
bespoke/
├── components/    # Shared component library (React components, hooks, utilities)
├── projects/      # Individual bespoke viz projects
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

## Creating a new bespoke component

1. Create a new directory under `bespoke/projects/`
2. Set up your project with its own `package.json` and build tooling to output an ESM module (`.mjs`) and a CSS file
3. Export a `mount` function from the entry point
4. Register the bundle in [site/bespokeComponentRegistry.ts](../site/bespokeComponentRegistry.ts)
5. Deploy the built assets to the expected URL path
6. Add the `{.bespoke-component}` block in your Google Doc
