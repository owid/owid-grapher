// Polyfills for JS features not supported in all browsers we support. We use core-js to polyfill features as needed.
//
// See docs/browser-support.md for details on our supported browsers.

// ES2022
import "core-js/actual/array/at"
import "core-js/actual/string/at"
import "core-js/actual/object/has-own"

// ES2023
import "core-js/actual/array/find-last"
import "core-js/actual/array/find-last-index"

import "core-js/actual/array/to-reversed"
import "core-js/actual/array/to-sorted"
import "core-js/actual/array/to-spliced"
import "core-js/actual/array/with"
