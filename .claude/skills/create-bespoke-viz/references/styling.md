# Visual style, colors, and Shadow DOM

## Chart furniture

Bespoke charts should read as part of the OWID chart family. For axis ticks and labels, gridlines, annotations and legends, don't design from scratch: look at how a similar existing project (or Grapher itself) styles these and match its font sizes, weights and grays.

## Colors

Default to the OWID palettes rather than inventing hex values. They live in `packages/@ourworldindata/grapher/src/color/` — browse `CustomSchemes.ts`, `ColorConstants.ts` and `ColorUtils.ts`, which hold much more than the workhorses projects reach for (`OwidDistinctColors` for categorical series, `GRAPHER_LIGHT_TEXT` and the `GRAY_*` scale for text and UI, `isDarkColor`/`darkenColorForText` for legible labels on colored marks).

Hardcoded hex is for semantic, domain-specific colors with no palette equivalent — e.g. causes-of-death's five category colors. Keep those in one constants file behind a single accessor.

## Stylesheets

`src/index.scss` is the single import hub and the copy from `example` already has the order right: vendor CSS, then `./grapher.scss`, then `./base.scss`, then project styles, then the shared component partials. The partials you add for shared and Grapher components must come after the OWID variables are in scope, since they use `$dark-text`, `$frame-color` and friends without defining them.

Copy `grapher.scss` from an existing project: it pulls the OWID SCSS partials from the `@ourworldindata/components` and `grapher` packages, putting `$sans-serif-font-stack`, `$dark-text`, `$gray-*` and the `sm-only` mixin in scope.

Strict BEM with full class names written out (`.my-viz-controls__row`, never `&__row`), per repo convention.

Don't bundle `@font-face`: Lato and Playfair are declared by the host document, and `@font-face` is document-scoped, so it reaches inside the shadow root. Reference the family names via the SCSS stacks.

## Portals

The readme's rule is that portaled UI must mount inside the shadow root. Two specifics:

- Tippy needs `useTippyContainer()`'s `getTippyContainer` passed as `appendTo`, or it lands on `document.body` where your styles don't reach.
- react-aria dropdown menus are the exception: they portal into the **light DOM**, because Enter-to-select is broken in Shadow DOM. Custom styling inside menu options therefore has to be inline styles — see `food-trade`'s controls and `EntityDropdown`'s `LocationIcon`.

`dev-only-global-css.css` supplies the global styles those portaled overlays need on the demo page; production articles already have them. Keep this entrypoint.
