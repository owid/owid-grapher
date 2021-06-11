// Taken from https://since1979.dev/respecting-prefers-reduced-motion-with-javascript-and-react/
export const prefersReducedMotion = (): boolean =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

// Detects desktop Safari, iOS Safari, and iOS Chrome/Firefox based on Safari
export const isSafari: boolean =
    typeof navigator !== "undefined" &&
    navigator.vendor !== "" &&
    navigator.vendor.indexOf("Apple") > -1
