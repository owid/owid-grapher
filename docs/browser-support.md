## Supported browsers

As of **2023-02-18**, we support the following browsers:

-   Safari 11.1+ (earlier versions are missing support for [Object rest destructuring](https://caniuse.com/mdn-javascript_operators_destructuring_rest_in_objects))
-   iOS Safari 11.3+ (earlier versions are missing support for [Object rest destructuring](https://caniuse.com/mdn-javascript_operators_destructuring_rest_in_objects))
-   Chrome/Edge: 66+ (earlier versions are giving out a `SyntaxError: Unexpected token '{'` that is hard to trace)
-   Opera 53+ (since Opera 53 is based on Chromium 66)
-   Firefox: 60+ (earlier versions are missing support for [importing modules](https://caniuse.com/es6-module))

**Overall, [this caniuse link shows which browsers are supported](https://caniuse.com/async-functions,mdn-javascript_operators_destructuring_rest_in_objects,es6-module)** (scroll down to "Feature summary").

### "Most breaking" features

"Most breaking" features we use are:

-   [Async functions](https://caniuse.com/async-functions), which introduce the keywords `async` and `await`.
-   [Object rest destructuring](https://caniuse.com/mdn-javascript_operators_destructuring_rest_in_objects), which introduces expressions like `const {a, ...rest} = obj`.
-   [ES6 modules](https://caniuse.com/es6-module), where we use `<script type="module">` (in HTML) and `import ... from "..."` (in JS)

Things will look a bit odd at times in browsers that don't support the [CSS grid `gap` property](https://caniuse.com/mdn-css_properties_gap_grid_context), but things still work just fine.

### Polyfills

We use polyfill.io (see `site/SiteConstants.ts`), so using modern methods like `str.replaceAll()` is fine as long as it's included in the list of polyfilled functions.

### Setting the Vite `target`

We have to be careful in increasing the `vite.config.ts` field `build.target`.

Dropping support for older browsers is fine, but it should be a conscious decision.
