# Population simulation iframe embed plan

## Goal

Allow the standalone GDoc page for the demography bespoke `simulation` variant to be embedded externally as an iframe, showing only the visualization and not the surrounding GDoc page chrome.

Use the quick path:

- Keep the page as a GDoc page.
- Add opt-in iframe behavior for a specific bespoke block.
- Hide normal GDoc/site chrome with iframe-only CSS.
- Provide a flexible-width embed snippet that preserves aspect ratio.

This plan complements `docs/population-simulation-url-param-sync-plan.md`: iframe `src` URLs can include the same demography query params for shareable embedded states.

## Proposed GDoc API

```yaml
{.bespoke-component}
  bundle: demography
  variant: simulation
  size: widest
  {.config}
    urlSync: true
    iframeEmbed: true
  {}
{}
```

`iframeEmbed` should default to `false`.

Only the standalone page should opt in. Normal articles with multiple bespoke instances should not.

## Desired external embed behavior

External embed code should look roughly like:

```html
<iframe
    src="https://ourworldindata.org/population-growth?demographyCountry=Japan&demographyFertility=1.2%2C1.4%2C1.7"
    loading="lazy"
    style="width: 100%; aspect-ratio: 16 / 10; border: 0;"
    title="Population projection simulation"
></iframe>
```

The exact aspect ratio should be chosen after testing the simulation at common widths. A likely starting point is either:

- `16 / 10` for a fairly wide desktop layout, or
- `4 / 3` if the component needs more vertical space.

Since CSS `aspect-ratio` is supported in the project’s browser targets, this is acceptable for the generated/recommended embed snippet.

Important limitation: CSS inside the iframe cannot directly control the iframe element’s height in the parent document. To preserve aspect ratio for external embeds, the **embed snippet itself** must set `width: 100%` and `aspect-ratio: ...` on the `<iframe>`.

## Implementation outline

### 1. Detect iframe mode on GDoc pages

Files:

- `site/gdocs/OwidGdocPage.tsx`
- existing helper: `site/IframeDetector.tsx`

Data pages and Grapher pages already include `IFrameDetector`, which adds `html.IsInIframe` when `window != window.top`.

Add `IFrameDetector` to GDoc pages too:

```tsx
<Head ...>
    ...
    <IFrameDetector />
</Head>
```

This should be safe because no iframe-specific styles apply unless we add a body/page class for this feature.

### 2. Detect opted-in demography embed pages

Files:

- `site/gdocs/OwidGdocPage.tsx`
- possibly a small helper near GDoc utilities

Compute whether the GDoc contains an iframe-embeddable bespoke block:

- `block.type === "bespoke-component"`
- `block.bundle === "demography"`
- `block.variant === "simulation"`
- `block.config.iframeEmbed === "true"`

For the quick path, restrict to pages with exactly one such opted-in block. If there are multiple, either:

- do not enable iframe page mode, or
- enable it but show all opted-in blocks.

Recommended first behavior: require exactly one opted-in block. This avoids accidentally exporting a multi-component article as an embed.

Add a body class when enabled:

```tsx
<body className={isBespokeIframeEmbedPage ? "GdocBespokeIframeEmbedPage" : undefined}>
```

### 3. Add stable data attributes to bespoke components

Files:

- `site/gdocs/components/BespokeComponent.tsx`

Add attributes on the outer wrapper:

```tsx
<div
    className={className}
    data-bespoke-bundle={block.bundle}
    data-bespoke-variant={block.variant}
    data-bespoke-iframe-embed={
        block.config.iframeEmbed === "true" ? "true" : undefined
    }
>
    ...
</div>
```

These attributes make CSS and debugging safer than relying only on layout class names.

### 4. Hide page chrome in iframe mode

Files:

- likely `site/gdocs/components/centered-article.scss`, or a new SCSS file imported by `site/owid.scss`

CSS should only apply when both are true:

- `html.IsInIframe`
- `body.GdocBespokeIframeEmbedPage`

Behavior:

- hide the site header
- hide the site footer
- hide the GDoc article header
- hide citation/license sections
- hide all non-embed article blocks
- show only the opted-in bespoke block
- remove page margins/background that would create whitespace in iframe embeds

Sketch with fully written selectors:

```scss
html.IsInIframe body.GdocBespokeIframeEmbedPage {
    margin: 0;
}

html.IsInIframe body.GdocBespokeIframeEmbedPage .site-header {
    display: none;
}

html.IsInIframe body.GdocBespokeIframeEmbedPage .site-footer {
    display: none;
}

html.IsInIframe
    body.GdocBespokeIframeEmbedPage
    .centered-article-container
    > * {
    display: none;
}

html.IsInIframe
    body.GdocBespokeIframeEmbedPage
    .centered-article-container
    > [data-bespoke-iframe-embed="true"] {
    display: block;
}
```

The actual header/footer selectors should be verified against current markup. If available, prefer the existing `hide-site-chrome` mixin for the global site chrome, then add GDoc-specific hiding rules.

### 5. Make the iframe document fill the viewport cleanly

Inside iframe mode, the page should not use the normal article grid width constraints. The opted-in bespoke block should be allowed to fill the iframe viewport width.

Suggested iframe-page CSS:

```scss
html.IsInIframe body.GdocBespokeIframeEmbedPage #owid-document-root {
    width: 100%;
}

html.IsInIframe body.GdocBespokeIframeEmbedPage .centered-article-container {
    display: block;
    width: 100%;
    margin: 0;
}

html.IsInIframe
    body.GdocBespokeIframeEmbedPage
    [data-bespoke-iframe-embed="true"] {
    width: 100%;
    max-width: none;
    margin: 0;
}
```

This makes the iframe content flexible. The parent iframe snippet preserves aspect ratio.

### 6. Optional component-level iframe sizing mode

The simulation component currently has desktop and narrow layouts based on measured container width. The desktop `.chart-content` has a fixed height around 500px; narrow layouts become taller and content-driven.

For a robust external iframe embed, consider adding an internal demography config later:

```yaml
iframeAspectRatio: 16 / 10
```

or a simpler boolean:

```yaml
embedSizing: true
```

First version can avoid this unless testing shows clipping at common widths.

If clipping occurs, preferred fixes are:

1. Choose a taller recommended iframe aspect ratio, e.g. `4 / 3`.
2. Add iframe-only demography CSS that makes the simulation fit the available iframe height.
3. As a last resort, allow vertical scrolling inside the iframe.

For external embeds, avoiding scrollbars is preferable, so start by testing and choosing a conservative aspect ratio.

## Interaction with URL param sync

The iframe `src` can include demography query params:

```text
https://ourworldindata.org/population-growth?demographyCountry=Japan&demographyFertility=1.2%2C1.4%2C1.7
```

Inside the iframe:

- URL params initialize the simulation state.
- User edits update the iframe’s own URL via `history.replaceState`.
- The parent page URL and original iframe `src` attribute will not update automatically.

That is acceptable for the first version because the stated goals are:

- external iframe embedding
- shareable standalone URLs

If future requirements include letting users copy the current iframe state from the parent page, we would need a separate `postMessage`-based embed API.

## Recommended embed snippet source

For the first version, we can document or manually provide the embed snippet.

A later enhancement could add a small “Embed this simulation” UI to the standalone page. That UI could:

- read the current URL, including query params
- produce an iframe snippet with the recommended aspect ratio
- include title and loading attributes

This is not required for the quick path.

## Files likely touched

- `site/gdocs/OwidGdocPage.tsx`
- `site/gdocs/components/BespokeComponent.tsx`
- `site/gdocs/components/centered-article.scss` or another imported SCSS file
- possibly `site/owid.scss` if a new SCSS file is added

Related files to inspect while implementing:

- `site/IframeDetector.tsx`
- `site/DataPage.scss`
- `site/css/chart.scss`
- `site/DataPageV2.tsx`
- `bespoke/projects/demography/src/styles.scss`

## Testing checklist

### Normal article behavior

- A regular GDoc page without `iframeEmbed: true` is unchanged.
- A GDoc page with demography blocks but no `iframeEmbed: true` is unchanged.
- Non-iframe view of the standalone page still shows normal GDoc chrome.

### Iframe behavior

- Loading the standalone page inside an iframe adds `html.IsInIframe`.
- Only the opted-in demography simulation is visible.
- Site header/footer, GDoc header, citation, license, subscribe banner, and other blocks are hidden.
- The visualization fills the iframe width.
- No unexpected body margins or article grid gutters remain.

### Aspect ratio behavior

Test recommended iframe snippets at common container widths:

- 320px
- 375px
- 640px
- 768px
- 1024px
- 1200px

For each width:

- iframe height follows the selected aspect ratio
- the simulation is usable
- no important controls are clipped
- no unwanted horizontal scrollbars appear

### URL state behavior

- `iframe src` URLs with `demographyCountry` and assumption params initialize the simulation correctly.
- User edits inside the iframe update the iframe URL.
- Opening the iframe `src` directly as a standalone page shows the same state.

## Acceptance criteria

- `iframeEmbed: true` opt-in exists for the demography `simulation` block.
- In iframe mode, the standalone GDoc page renders only the opted-in visualization.
- The embed is flexible-width and documented with an aspect-ratio-preserving iframe snippet.
- Normal GDoc/article rendering remains unaffected.
- The iframe mode works with the demography URL params from the param-sync plan.
