## Supported browsers

As of **2024-03-20**, we support the following browsers:

-   Safari 12+ [September 2018] (earlier versions are missing support for [the CSS `gap` property](https://caniuse.com/mdn-css_properties_gap_grid_context))
-   iOS Safari 12+ [September 2018] (earlier versions are missing support for [the CSS `gap` property](https://caniuse.com/mdn-css_properties_gap_grid_context))
-   Chrome/Edge 66+ [April 2018] (earlier versions are missing support for [Optional catch binding](https://caniuse.com/mdn-javascript_statements_try_catch_optional_catch_binding))
-   Opera 53+ [May 2018] (since Opera 53 is based on Chromium 66)
-   Firefox 78+ [June 2020] (earlier versions are missing support for [Unicode character class escapes in regular expressions](https://caniuse.com/mdn-javascript_regular_expressions_unicode_character_class_escape))

**Overall, [this caniuse link shows which browsers are supported](https://caniuse.com/mdn-css_properties_gap_grid_context,es6-module,mdn-javascript_statements_try_catch_optional_catch_binding,mdn-javascript_regular_expressions_unicode_character_class_escape)** (scroll down to "Feature summary").

### "Most breaking" features

"Most breaking" features we use are:

-   [Optional catch binding](https://caniuse.com/mdn-javascript_statements_try_catch_optional_catch_binding), which allows for `catch {}` instead of `catch (e) {}`.
    We don't _have_ to use it, but Chrome < 66 is so uncommon now that's it not a worry.
-   [ES6 modules](https://caniuse.com/es6-module), where we use `<script type="module">` (in HTML) and `import ... from "..."` (in JS)
-   [The CSS `gap` property](https://caniuse.com/mdn-css_properties_gap_grid_context), together with `row-gap` and `column-gap`, which was previously prefixed by `grid-` in most browsers. Without support for these properties Google Docs-based pages are borderline unusable; however our interactive charts themselves work pretty much fine on their standalone pages.
-   [Unicode character class escapes in regular expressions](https://caniuse.com/mdn-javascript_regular_expressions_unicode_character_class_escape), which lets you do something like `\p{Letter}` to match any unicode letters in a RegExp.

### Polyfills

We use https://cdnjs.cloudflare.com/polyfill (see `site/SiteConstants.ts`), so using modern methods like `str.replaceAll()` is fine as long as it's included in the list of polyfilled functions.

### Setting the Vite `target`

We have to be careful in increasing the `vite.config.ts` field `build.target`.

Dropping support for older browsers is fine, but it should be a conscious decision.
