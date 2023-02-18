const polyfillFeatures = [
    "es6",
    "fetch",
    "URL",
    "IntersectionObserver",
    "IntersectionObserverEntry",
    "ResizeObserver",
]
export const POLYFILL_URL: string = `https://polyfill.io/v3/polyfill.min.js?features=${polyfillFeatures.join(
    ","
)}`
