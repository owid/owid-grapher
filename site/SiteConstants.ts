// See https://polyfill.io/v3/url-builder/ for a list of all supported features
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
export const POLYFILL_URL: string = `https://polyfill.io/v3/polyfill.min.js?features=${polyfillFeatures.join(
    ","
)}`

export const GOOGLE_FONTS_URL: string = `https://fonts.googleapis.com/css?family=Lato:300,400,400i,700,700i,900|Playfair+Display:400,600,700&display=swap`
