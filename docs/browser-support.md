## Supported browsers

As of **2023-02-18**, we support the following browsers:

-   Safari 11.1+ (earlier versions are missing support for [Object rest destructuring](https://caniuse.com/mdn-javascript_operators_destructuring_rest_in_objects))
-   iOS Safari 11.3+ (earlier versions are missing support for [Object rest destructuring](https://caniuse.com/mdn-javascript_operators_destructuring_rest_in_objects))
-   Chrome/Edge: 61+ (earlier versions are missing support for [passing a record to the URLSearchParams constructor](https://caniuse.com/mdn-api_urlsearchparams_urlsearchparams_record))
-   Opera 48+
-   Firefox: 58+ partial support (embedded explorers have major layout issues), 59+ full support

**Overall, [this caniuse link shows which browsers are supported](https://caniuse.com/async-functions,mdn-javascript_operators_destructuring_rest_in_objects,mdn-api_urlsearchparams_urlsearchparams_record)** (scroll down to "Feature summary").

### "Most breaking" features

"Most breaking" features we use are:

-   [Async functions](https://caniuse.com/async-functions), which introduce the keywords `async` and `await`.
-   [Object rest destructuring](https://caniuse.com/mdn-javascript_operators_destructuring_rest_in_objects), which introduces expressions like `const {a, ...rest} = obj`.
-   [Passing a record to the URLSearchParams constructor](https://caniuse.com/mdn-api_urlsearchparams_urlsearchparams_record), which we use in URL manipulation.

Things will look a bit odd at times in browser that don't support the [CSS grid `gap` property](https://caniuse.com/mdn-css_properties_gap_grid_context), but things still work just fine.

### Polyfills

We use polyfill.io (see `site/SiteConstants.ts`), so using modern methods like `str.replaceAll()` is fine as long as it's included in the list of polyfilled functions.

### Setting the TypeScript `target`

We have to be careful in increasing the `tsconfig.json` field `target`.
Currently, we have it set to `es2019`, where the "most breaking" features are as above.
If we were to set it to `es2020` instead, TS would not downcompile the [optional chaining operator](https://caniuse.com/mdn-javascript_operators_optional_chaining) any longer, making that the most breaking feature.
This would then drop support for `Safari < 13.1, iOS Safari < 13.4, Chrome < 80, ...`.
Safari is arguably the most important one of these to consider, since Safari major versions are bound to the macOS/iOS version, and there's lots of devices out there running outdated OS versions.

Dropping support for older browsers is fine, but it should be a conscious decision.
