/**
 * The linked `@ourworldindata/*` packages and the shared
 * `bespoke/{components,hooks}` workspaces resolve their dependencies relative to
 * their real paths, so each would otherwise load its own copy. Every package
 * here keeps state in module or context scope, where a second copy splits it in
 * two: React hooks, the react-query `QueryClient` context, react-aria's
 * `shadowDOM()` flag and its React contexts.
 */
export const DEDUPED_PACKAGES = [
    "react",
    "react-dom",
    "@tanstack/react-query",
    "react-aria",
    "react-aria-components",
    "react-stately",
    "@react-stately/flags",
]
