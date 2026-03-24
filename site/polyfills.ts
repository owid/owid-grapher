// Polyfills for JS features not supported in all browsers we support. We use core-js to polyfill features as needed.
//
// See docs/browser-support.md for details on our supported browsers.
// There are a few polyfills in here for features that are supported in all our supported browsers, but we include them here anyway so that there's at least a chance that older browser versions continue to work, even though they're unsupported.

// ES2022
import "core-js/es/array/at" // Chrome 92+, Safari 15.4+, Firefox 90+
import "core-js/es/string/at" // Chrome 92+, Safari 15.4+, Firefox 90+
import "core-js/es/object/has-own" // Chrome 93+, Safari 15.4+, Firefox 92+

// ES2023
import "core-js/es/array/find-last" // Chrome 97+, Safari 15.4+, Firefox 104+
import "core-js/es/array/find-last-index" // Chrome 97+, Safari 15.4+, Firefox 104+

import "core-js/es/array/to-reversed" // Chrome 110+, Safari 16.0+, Firefox 115+
import "core-js/es/array/to-sorted" // Chrome 110+, Safari 16.0+, Firefox 115+
import "core-js/es/array/to-spliced" // Chrome 110+, Safari 16.0+, Firefox 115+
import "core-js/es/array/with" // Chrome 110+, Safari 16.0+, Firefox 115+
