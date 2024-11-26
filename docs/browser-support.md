## Supported browsers

As of **2024-11-26**, we support the following browsers:

- Safari 13.1+ [March 2020] (earlier versions are missing support for [the nullish coalescing operator (`??`)](https://caniuse.com/mdn-javascript_operators_nullish_coalescing))
- iOS Safari 13.4+ [March 2020] (earlier versions are missing support for [the nullish coalescing operator (`??`)](https://caniuse.com/mdn-javascript_operators_nullish_coalescing))
- Chrome/Edge 80+ [February 2020] (earlier versions are missing support for [the nullish coalescing operator (`??`)](https://caniuse.com/mdn-javascript_operators_nullish_coalescing))
- Opera 67+ [February 2020] (since Opera 67 is based on Chromium 80)
- Firefox 78+ [June 2020] (earlier versions are missing support for [Unicode character class escapes in regular expressions](https://caniuse.com/mdn-javascript_regular_expressions_unicode_character_class_escape))

**Overall, [this caniuse link shows which browsers are supported](https://caniuse.com/mdn-javascript_operators_nullish_coalescing,template-literals,mdn-css_properties_gap_grid_context,es6-module,mdn-javascript_regular_expressions_unicode_character_class_escape)** (scroll down to "Feature summary").

### "Most breaking" features

"Most breaking" features we use are:

- [Nullish coalescing operator (`??`)](https://caniuse.com/mdn-javascript_operators_nullish_coalescing), allowing for expressions like `const foo = null ?? 'default string'`.
- [ES6 modules](https://caniuse.com/es6-module), where we use `<script type="module">` (in HTML) and `import ... from "..."` (in JS)
- [The CSS `gap` property](https://caniuse.com/mdn-css_properties_gap_grid_context), together with `row-gap` and `column-gap`, which was previously prefixed by `grid-` in most browsers. Without support for these properties Google Docs-based pages are borderline unusable; however our interactive charts themselves work pretty much fine on their standalone pages.
- [Unicode character class escapes in regular expressions](https://caniuse.com/mdn-javascript_regular_expressions_unicode_character_class_escape), which lets you do something like `\p{Letter}` to match any unicode letters in a RegExp.

### Polyfills

We use https://cdnjs.cloudflare.com/polyfill (see `site/SiteConstants.ts`), so using modern methods like `str.replaceAll()` is fine as long as it's included in the list of polyfilled functions.

### Setting the Vite `target`

We have to be careful in increasing the `vite.config.ts` field `build.target`.

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
