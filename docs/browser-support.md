## Supported browsers

As of **2026-10-26**, we officially support the following browsers:

- Safari 16.4+ [March 2023]
- iOS Safari 16.4+ [March 2023]
- Chrome/Edge 106+ [September 2022] (note that Chrome 109 is the last supported version on Windows 7/8, so we want to support that for a tad bit longer)
- Firefox 110+ [February 2023] (note that 115 is an ESR version)

Older versions of these browsers may still work, but we don't actively test or support them, and the site may be seriously broken.

Our **CSS** additionally supports Safari/iOS Safari 16.0+, so that pages still look right where our JS doesn't run (e.g. Safari < 16.4 hits a `SyntaxError` and falls back to the no-JS experience, see below). CSS is built with the separate `CSS_BUILD_TARGET` in `rolldown.config-common.mts`. If we instead set the CSS target to 16.4+, it would rewrite media queries to [the `width>=769px` syntax](https://caniuse.com/css-media-range-syntax), breaking all media queries for older browsers.

### "Most breaking" features

"Most breaking" features we use are:

- [CSS `:has()` selector](https://caniuse.com/css-has) (Chrome 105+, Safari 15.4+, Firefox 121+) — used extensively in stylesheets. Note: Firefox only supports `:has()` from version 121 (December 2023), so make sure it degrades gracefully in Firefox <121. Beware of `:not(:has(...))`: in browsers without `:has()` support the whole rule is dropped, so only use it for cosmetic tweaks.
- [CSS container queries (`@container`)](https://caniuse.com/css-container-queries) (Chrome 106+, Safari 16.0+, Firefox 110+) — used in grapher controls and tooltips.
- [Lookbehind assertions in regular expressions](https://caniuse.com/js-regexp-lookbehind) (Chrome 62+, Firefox 79+, Safari 16.4+) — used by `tinykeys`. A regex literal is parsed with the script, so in older Safari the whole bundle fails with a `SyntaxError`.

### "Most breaking" features in Vite-generated code

Vite/Rolldown may emit syntax in the bundled output that we don't actively write ourselves. Vite will use syntax that are not supported in older browsers. The most notable examples are:

- [Private class methods](https://caniuse.com/mdn-javascript_classes_private_class_methods) - Chrome 84+, Safari 15+, Firefox 90+.
- [Nullish coalescing assignment operator (`??=`)](https://caniuse.com/mdn-javascript_operators_nullish_coalescing_assignment) — Chrome 85+, Safari 14+, Firefox 79+.
- [Class static blocks](https://caniuse.com/mdn-javascript_classes_static_initialization_blocks) (`static { … }`) — Chrome 94+, Firefox 93+, Safari 16.4+.

### Features we can't yet use

The following features are **not** available across all our supported browsers and should be avoided (or guarded) until we raise our minimum targets:

- [`Promise.withResolvers()`](https://caniuse.com/mdn-javascript_builtins_promise_withresolvers) — Chrome 119+, Firefox 121+, Safari 17.4+.
- [CSS native nesting](https://caniuse.com/css-nesting) — Chrome 112+, Firefox 117+, Safari 16.4+.
- [`URL.canParse()`](https://caniuse.com/mdn-api_url_canparse_static) — Chrome 120+, Firefox 115+, Safari 17+.
- [Popover API (`popover` attribute, `showPopover()`)](https://caniuse.com/mdn-api_htmlelement_popover) — Chrome 114+, Firefox 125+, Safari 17+.
- [`Array.fromAsync()`](https://caniuse.com/mdn-javascript_builtins_array_fromasync) — Chrome 121+, Firefox 115+, Safari 16.4+. Missing in Chrome 111–120.
- [RegExp `v` flag (unicodeSets)](https://caniuse.com/mdn-javascript_builtins_regexp_unicodesets) — Chrome 112+, Firefox 116+, Safari 17+. This includes `tinykeys` keybindings using the `(regex)` key syntax, which compile with the `v` flag.
- [CSS subgrid](https://caniuse.com/css-subgrid) — Firefox 71+, Safari 16+, but Chrome 117+.
- [CSS support for oklab, oklch, lab, lch color spaces](https://caniuse.com/wf-oklab) — Chrome 111+, Firefox 113+, Safari 15.4+.
- [CSS `color-mix()` function](https://caniuse.com/wf-color-mix) — Chrome 111+, Firefox 113+, Safari 16.2+.
- [`Map.getOrInsert()`](https://caniuse.com/wf-getorinsert) — Chrome 145+, Firefox 144+, Safari 26.2+.
- [`AbortSignal.any()`](https://caniuse.com/mdn-api_abortsignal_any_static) — Chrome 116+, Firefox 124+, Safari 17.4+.
- [Fullscreen API, unprefixed (`requestFullscreen()`, `document.fullscreenElement`)](https://caniuse.com/fullscreen) — Chrome 71+, Firefox 64+, Safari 16.4+, but not at all on iPhone. Check `document.fullscreenEnabled` before offering fullscreen.
- [`ClipboardItem`](https://caniuse.com/mdn-api_clipboarditem) — Chrome 76+, Safari 13.1+, but Firefox 127+.
- [CSS `lh` unit](https://caniuse.com/mdn-css_types_length_lh) — Chrome 109+, Firefox 120+, Safari 16.4+. Declare a fallback (e.g. in `em`) first.
- [CSS `@property`](https://caniuse.com/mdn-css_at-rules_property) — Chrome 85+, Firefox 128+, Safari 16.4+.
- [CSS `dvh`/`svh`/`lvh` units](https://caniuse.com/viewport-unit-variants) — Chrome 108+, Firefox 101+, Safari 15.4+. Use a `vh` fallback.

Note: some of the JS features above (e.g. `Map.getOrInsert`) could be polyfilled using [core-js](https://github.com/nicolo-ribaudo/core-js-contrib) or similar libraries if we wanted to use them before raising our browser targets. CSS features or JS syntax features obviously can't be polyfilled this way.

### Fine as progressive enhancement only

These aren't supported in all our target browsers, but are fine to use where the page still works without them (e.g. it just loses an animation or some polish):

- [CSS `@starting-style`](https://caniuse.com/mdn-css_at-rules_starting-style) — Chrome 117+, Firefox 129+, Safari 17.5+.
- [View Transitions API](https://caniuse.com/view-transitions) — Chrome 111+, Safari 18+, Firefox 144+. Always feature-detect `document.startViewTransition` and fall back to applying the update directly, e.g. `document.startViewTransition ? document.startViewTransition(update) : update()`. `view-transition-name` and `::view-transition-*` styles are simply ignored where unsupported. React's (19.3+) `<ViewTransition>` component does this progressive fallback automatically.
- [CSS `text-wrap: balance` / `pretty`](https://caniuse.com/css-text-wrap-balance) — Chrome 114+, Firefox 121+, Safari 17.5+.
- [CSS `scrollbar-width`](https://caniuse.com/mdn-css_properties_scrollbar-width) and [`scrollbar-gutter`](https://caniuse.com/mdn-css_properties_scrollbar-gutter) — Safari 18.2+ (`scrollbar-width` is also Chrome 121+). Pair `scrollbar-width: none` with `::-webkit-scrollbar { display: none }`.

### Polyfills

We ship explicit polyfills in `packages/@ourworldindata/utils/src/polyfills.ts`, (via [core-js](https://github.com/zloirock/core-js)), imported at the top of the site entry points, for features that aren't available in all supported browsers. Currently polyfilled:

- `Array.prototype.at`, `String.prototype.at` — Chrome 92+, Safari 15.4+, Firefox 90+
- `Object.hasOwn` — Chrome 93+, Safari 15.4+, Firefox 92+
- `Array.prototype.findLast`, `Array.prototype.findLastIndex` — Chrome 97+, Safari 15.4+, Firefox 104+
- `Array.prototype.toReversed`, `Array.prototype.toSorted`, `Array.prototype.toSpliced`, `Array.prototype.with` — Chrome 110+, Safari 16.0+, Firefox 115+
- `Object.groupBy`, `Map.groupBy` — Chrome 117+, Safari 17.4+, Firefox 119+
- `Set` methods (`union`, `intersection`, `difference`, `symmetricDifference`, etc.) — Chrome 122+, Safari 17.0+, Firefox 127+
- Iterator helpers (`.map()`, `.filter()`, `.reduce()`, `.some()`, `.every()`, `.find()`, etc.) — Chrome 122+, Safari 18.4+, Firefox 131+

This means that we can use these features in our code without worrying about browser support.

### Setting the Vite `target`

We have to be careful in increasing the `vite.config-common.mts` field `build.target`.

Dropping support for older browsers is fine, but it should be a conscious decision.

## Detecting disabled/non-functioning JS

We try our very best to detect when the browser JS is disabled or non-functioning in any way.
There are many such ways:

- (1) JS is disabled at the browser level.
- (2) JS is disabled via an extension like Ghostery or NoScript.
- (3) JS is enabled, but the browser doesn't support `<script type="module">`.
- (4) JS is enabled, but the browser is old and loading our code results in a `SyntaxError` (because of "relatively modern" syntax features like `await`, `import`, `var?.attr` etc.).
- (5) One of our core JS assets (e.g. `owid.mjs`) cannot be loaded, either because of networking issues, an extension, or something else.
- (6) There is a runtime error early on in script execution (e.g. in `runSiteFooterScripts`), e.g. calling an undefined function <-- **_this one we don't handle!_**

For (1) and (2), we can get by with using `<noscript>` elements, containing HTML that is only ever parsed if scripting is disabled. However, to detect the other failure cases, we need more sophisticated error handling, as such:

- Our static renders all start out with `<html class="js-disabled">`, via [Html.tsx](../site/Html.tsx).
    - Addresses (1) and (2), where no further scripts are ever executed.
- An inline script called [`<NoJSDetector>`](../site/NoJSDetector.tsx) (contained in `<Head>`) that is executed early checks if `<script type="module">` is supported, and then replaces `js-disabled` with `js-enabled`. It is executed synchronously before any rendering is performed, meaning that CSS styles targeting `js-disabled` are never evaluated, and e.g. fallback images are not downloaded if not needed.
    - Addresses (3).
- This same inline script also sets up a global `window.onerror` event handler. If that one catches a global `SyntaxError` _under our own domain_, then we go back to replacing `js-enabled` with `js-disabled`. The domain check disregards failures coming from other scripts (e.g. Google Tag Manager) or browser extensions.
    - Addresses (4).
- Another inline script called [`<ScriptLoadErrorDetector>`](../site/NoJSDetector.tsx) (contained in `<SiteFooter>`) sets up a `<script onerror="...">` handler for our core JS assets, which we mark using a `data-attach-owid-error-handler` attribute. If the handler fires (meaning the script couldn't be loaded), we again replace `js-enabled` with `js-disabled`.
    - Addresses (5).
- If `owid.mjs` executes successfully, it will additionally add a `js-loaded` class to the `<html>` element.

### CSS classes

This all gives access to the following CSS classes:

- `js-disabled` and `js-enabled`, mutually exclusive and hopefully self-explanatory.
    - Note that there can be cases where we temporarily are at `js-enabled` and then go back to `js-disabled`, e.g. if we encounter a syntax error.
- `js-loaded`, which is applied a bit after `js-enabled` and is more technical.
- `js--hide-if-js-disabled` and `.js--hide-if-js-enabled`, defined in [noscript.scss](../site/css/noscript.scss) can be used as global utility classes.
- Likewise, `js--show-warning-block-if-js-disabled` can show a big warning block if necessary.

### Handling runtime errors (6)

We could totally do a better job of handling global runtime errors, and falling back to no-JS is probably a good idea in that case, too.
However, we would need to do a good job communicating the difference to the user - in this case the messaging shouldn't be "You need to enable JavaScript and that's why this isn't interactive", but rather "We screwed up and that's why this isn't interactive".
