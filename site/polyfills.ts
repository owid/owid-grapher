// Polyfills for JS features not supported in all browsers we support. We use core-js to polyfill features as needed.
//
// See docs/browser-support.md for details on our supported browsers.
// There are a few polyfills in here for features that are supported in all our supported browsers, but we include them here anyway so that there's at least a chance that older browser versions continue to work, even though they're unsupported.

// Relative indexing method: Array.prototype.at, String.prototype.at
// https://core-js.io/docs/features/proposals/relative-indexing-method
import "core-js/proposals/relative-indexing-method" // Chrome 92+, Safari 15.4+, Firefox 90+

// Object.hasOwn
// https://core-js.io/docs/features/proposals/accessible-object-prototype-hasownproperty
import "core-js/proposals/accessible-object-hasownproperty" // Chrome 93+, Safari 15.4+, Firefox 92+

// Array find from last: findLast, findLastIndex
// https://core-js.io/docs/features/proposals/array-find-from-last
import "core-js/proposals/array-find-from-last" // Chrome 97+, Safari 15.4+, Firefox 104+

// Array change by copy: toReversed, toSorted, toSpliced, with
// https://core-js.io/docs/features/proposals/change-array-by-copy
import "core-js/proposals/change-array-by-copy-stage-4" // Chrome 110+, Safari 16.0+, Firefox 115+

// Array & Map grouping: Object.groupBy, Map.groupBy
// https://core-js.io/docs/features/proposals/array-grouping
import "core-js/proposals/array-grouping-v2" // Chrome 117+, Safari 17.4+, Firefox 119+

// Set methods: union, intersection, difference, symmetricDifference, etc.
// https://core-js.io/docs/features/proposals/set-methods
import "core-js/proposals/set-methods-v2" // Chrome 122+, Safari 17.0+, Firefox 127+

// Iterator helpers: map, filter, reduce, some, every, find, etc.
// https://core-js.io/docs/features/proposals/iterator-helpers
import "core-js/proposals/iterator-helpers-stage-3-2" // Chrome 122+, Safari 18.4+, Firefox 131+

// Map upsert: getOrInsert, getOrInsertComputed
// https://core-js.io/docs/features/proposals/map-upsert
import "core-js/proposals/map-upsert-v4" // Chrome 145+, Safari 26.2+, Firefox 144+
