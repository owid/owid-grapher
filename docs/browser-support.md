## Supported browsers

As of **2026-03-23**, we support the following browsers:

- Safari 16.4+ [March 2023]
- iOS Safari 16.4+ [March 2023]
- Chrome/Edge 111+ [March 2023]
- Opera 97+ [March 2023] (since Opera 97 is based on Chromium 111)
- Firefox 114+ [June 2023] (115 is an ESR version)

**Overall, [this caniuse link shows which browsers are supported](https://caniuse.com/mdn-javascript_builtins_array_toreversed,css-has,css-container-queries,mdn-javascript_builtins_array_findlast)** (scroll down to "Feature summary").

### "Most breaking" features

"Most breaking" features we use are:

- [`Array.prototype.toReversed()`](https://caniuse.com/mdn-javascript_builtins_array_toreversed) (Chrome 110+, Safari 16+, Firefox 115+) — used extensively across grapher and site code.
- [CSS `:has()` selector](https://caniuse.com/css-has) (Chrome 105+, Safari 15.4+, Firefox 121+) — used extensively in stylesheets. Note: Firefox only supports `:has()` from version 121 (December 2023), so it degrades gracefully in Firefox 114–120.
- [CSS container queries (`@container`)](https://caniuse.com/css-container-queries) (Chrome 105+, Safari 16+, Firefox 110+) — used in grapher controls and tooltips.
- [`Array.prototype.findLast()` / `findLastIndex()`](https://caniuse.com/mdn-javascript_builtins_array_findlast) (Chrome 97+, Safari 15.4+, Firefox 104+).

### Polyfills

We ship explicit polyfills in `site/polyfills.ts` for ES2022/ES2023 features (e.g. `Array.at`, `Array.findLast`, `Array.toReversed`, `Array.toSorted`) that aren't available in all supported browsers. The polyfill file is imported at the top of `site/owid.entry.ts` before any other code runs.

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
