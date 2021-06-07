// Taken from https://since1979.dev/respecting-prefers-reduced-motion-with-javascript-and-react/
export const prefersReducedMotion = (): boolean =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
