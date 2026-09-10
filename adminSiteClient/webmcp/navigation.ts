/**
 * Lets code outside React (WebMCP tools, `window.admin.goto`) navigate the
 * admin SPA.
 *
 * The admin uses react-router v5, whose history object is created inside
 * `<BrowserRouter>` and never exported. `WebMcpHistoryBridge` in AdminApp.tsx
 * captures it here via `useHistory()`.
 *
 * Pages that would lose state on navigation register a guard. The chart editor
 * does this for unsaved changes: its `<Prompt>` would otherwise pop a blocking
 * `window.confirm` in the middle of a tool call, so tools refuse up front and
 * tell the agent what to do instead.
 */
import type { History } from "history"
import urljoin from "url-join"

/** Returns a reason navigation must not happen right now, or undefined. */
export type NavigationGuard = () => string | undefined

export type NavigationResult =
    | { ok: true; path: string; unchanged?: true }
    | { ok: false; reason: string }

let adminHistory: History | undefined
const guards = new Set<NavigationGuard>()

export function setAdminHistory(history: History | undefined): void {
    adminHistory = history
}

export function registerNavigationGuard(
    guard: NavigationGuard,
    signal: AbortSignal
): void {
    if (signal.aborted) return
    guards.add(guard)
    signal.addEventListener("abort", () => guards.delete(guard), {
        once: true,
    })
}

export function navigationBlockedReason(): string | undefined {
    for (const guard of guards) {
        const reason = guard()
        if (reason) return reason
    }
    return undefined
}

/** Accepts admin-relative paths only: "/charts/123/edit", not URLs or files. */
export function isValidAdminPath(path: string): boolean {
    return (
        path.startsWith("/") &&
        !path.startsWith("//") &&
        !/[?#\s]/.test(path) &&
        !/\.[a-z0-9]{1,5}$/i.test(path)
    )
}

/** The path the browser is on, as the router sees it: without `/admin`. */
function currentAdminPath(): string {
    if (typeof window === "undefined") return ""
    return window.location.pathname.replace(/^\/admin(?=\/|$)/, "") || "/"
}

export function navigateTo(
    path: string,
    {
        search = "",
        replace = false,
    }: { search?: string; replace?: boolean } = {}
): NavigationResult {
    if (!isValidAdminPath(path))
        return { ok: false, reason: `"${path}" is not an admin page path.` }

    const normalizedSearch =
        search && !search.startsWith("?") ? `?${search}` : search

    // Going where we already are is a no-op, not a navigation, so it must not
    // trip the unsaved-changes guard: an agent that opens the editor it is
    // already in should get an answer, not the dead end of being told to save
    // changes it is trying to reach the page to make.
    if (path === currentAdminPath() && normalizedSearch === "")
        return { ok: true, path, unchanged: true }

    const blocked = navigationBlockedReason()
    if (blocked) return { ok: false, reason: blocked }

    if (adminHistory) {
        const location = { pathname: path, search: normalizedSearch }
        if (replace) adminHistory.replace(location)
        else adminHistory.push(location)
    } else {
        // No router mounted (should not happen in the SPA); a full load still
        // gets the user there.
        window.location.assign(urljoin("/admin", path) + normalizedSearch)
    }
    return { ok: true, path: path + normalizedSearch }
}
