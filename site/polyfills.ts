// Polyfills for JS features not supported in all browsers we support. We use core-js to polyfill features as needed.
//
// See docs/browser-support.md for details on our supported browsers.

// ES2022
import "core-js/es/array/at"
import "core-js/es/string/at"
import "core-js/es/object/has-own"

// ES2023
import "core-js/es/array/find-last"
import "core-js/es/array/find-last-index"

import "core-js/es/array/to-reversed"
import "core-js/es/array/to-sorted"
import "core-js/es/array/to-spliced"
import "core-js/es/array/with"
