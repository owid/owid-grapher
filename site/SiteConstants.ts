// See https://cdnjs.cloudflare.com/polyfill/v3/url-builder/ for a list of all supported features
const polyfillFeatures = [
    "es2019", // Array.flat, Array.flatMap, Object.fromEntries, ...
    "es2020", // String.matchAll, Promise.allSettled, ...
    "es2021", // String.replaceAll, Promise.any, ...
    "es2022", // Array.at, String.at, ...
    "IntersectionObserver",
    "IntersectionObserverEntry",
    "ResizeObserver",
    "globalThis", // some dependencies use this
]
export const POLYFILL_URL: string = `https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=${polyfillFeatures.join(
    ","
)}`

export const DEFAULT_LOCAL_BAKE_DIR = "localBake"
