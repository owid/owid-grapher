// See https://cdnjs.cloudflare.com/polyfill/ for a list of all supported features
const polyfillFeatures = [
    "es2019", // Array.flat, Array.flatMap, Object.fromEntries, ...
    "es2020", // String.matchAll, Promise.allSettled, ...
    "es2021", // String.replaceAll, Promise.any, ...
    "es2022", // Array.at, String.at, ...
    "es2023", // Array.findLast, Array.toReversed, Array.toSorted, Array.with, ...
    "IntersectionObserver",
    "IntersectionObserverEntry",
    "ResizeObserver",
    "globalThis", // some dependencies use this
]
const POLYFILL_VERSION = "4.8.0"
export const POLYFILL_URL: string = `https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?version=${POLYFILL_VERSION}&features=${polyfillFeatures.join(
    ","
)}`

export const DEFAULT_LOCAL_BAKE_DIR = "localBake"

export const GRAPHER_PREVIEW_CLASS = "grapherPreview"

export const SMALL_BREAKPOINT_MEDIA_QUERY = "(max-width: 768px)"

export const TOUCH_DEVICE_MEDIA_QUERY =
    "(hover: none), (pointer: coarse), (pointer: none)"

export const DEFAULT_TOMBSTONE_REASON =
    "Our World in Data is designed to be an evergreen publication. This " +
    "means that when a page cannot be updated due to outdated data or " +
    "missing information, we prefer to remove it rather than present " +
    "incomplete or inaccurate research and data to our readers."
