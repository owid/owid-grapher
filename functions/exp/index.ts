import { Experiment, experiments } from "@ourworldindata/utils"
import { parseCookie, stringifySetCookie, type SetCookie } from "cookie"
import { Env } from "../_common/env.js"

/*
 * `/exp` — the experiment arm switcher.
 *
 * Forcing an arm needs no new machinery in the request path: the middleware
 * (functions/_common/experiments.ts) honours an existing `exp-<id>` cookie and
 * only rolls the dice when there isn't one. So "force an arm" is just "set the
 * cookie", and this page is a way to do that by tapping a button rather than
 * by editing cookies in devtools — the only way that works on a phone.
 *
 * Setting the cookie here, before you navigate to the page under test, also
 * means the arm is in place when that page's HTML is assembled: no flash of
 * the other arm, and nothing for the middleware to parse on every request.
 *
 * The page does not exist in production — the request is handed straight to
 * the baked assets there, so neither a shared link nor a crawler can force an
 * arm and skew a live experiment's results, and the route stays transparent
 * to anything that might one day be baked at this path.
 *
 * Note that `experimentsMiddleware` still runs for this page, as it does for
 * every page: loading the switcher can itself assign you an arm of an
 * experiment whose paths cover `/`. Clearing is right there if that gets in
 * the way.
 */

/** Clearing a cookie = re-sending it already expired. */
const EXPIRED = new Date(0)

const CLEAR_ALL_ACTION = "clear-all"

export async function handleExperimentSwitcher(
    request: Request,
    env: Env,
    configuredExperiments: Experiment[] = experiments
): Promise<Response> {
    if (env.ENV === "production") return env.ASSETS.fetch(request)

    const activeExperiments = configuredExperiments.filter(
        (e) => !e.isExpired()
    )

    if (request.method === "POST")
        return handleSubmission(request, activeExperiments)

    if (request.method !== "GET" && request.method !== "HEAD")
        return new Response(null, {
            status: 405,
            headers: { allow: "GET, HEAD, POST" },
        })

    const url = new URL(request.url)
    const cookies = parseCookie(request.headers.get("cookie") || "")
    return htmlResponse(
        renderPage({
            experiments: activeExperiments,
            cookies,
            returnPath: sanitizeReturnPath(url.searchParams.get("from")),
            env: env.ENV,
        })
    )
}

export const onRequest: PagesFunction<Env> = ({ request, env }) =>
    handleExperimentSwitcher(request, env)

async function handleSubmission(
    request: Request,
    activeExperiments: Experiment[]
): Promise<Response> {
    const form = await request.formData()
    const returnPath = sanitizeReturnPath(asString(form.get("from")))
    const cookiesToSet: SetCookie[] = []

    if (asString(form.get("action")) === CLEAR_ALL_ACTION) {
        for (const experiment of activeExperiments)
            cookiesToSet.push(clearCookie(experiment.id))
    } else {
        const experimentId = asString(form.get("experiment"))
        const experiment = activeExperiments.find((e) => e.id === experimentId)
        if (!experiment)
            return new Response(`Unknown experiment: ${experimentId}\n`, {
                status: 400,
            })

        // An empty arm means "clear", so the next request gets a fresh
        // assignment from the middleware.
        const armId = asString(form.get("arm")) ?? ""
        if (armId === "") {
            cookiesToSet.push(clearCookie(experiment.id))
        } else {
            const arm = experiment.getArmById(armId)
            if (!arm)
                return new Response(
                    `Unknown arm for ${experiment.id}: ${armId}\n`,
                    { status: 400 }
                )
            cookiesToSet.push({
                name: experiment.id,
                value: arm.id,
                expires: experiment.expires,
                path: "/",
            })
        }
    }

    // 303 so the browser follows up with a GET: either back to the page under
    // test, now in the chosen arm, or to a freshly rendered switcher.
    const headers = new Headers({
        location: returnPath ?? "/exp",
        "cache-control": "no-store",
    })
    for (const cookie of cookiesToSet)
        headers.append("set-cookie", stringifySetCookie(cookie))
    return new Response(null, { status: 303, headers })
}

function clearCookie(name: string): SetCookie {
    return { name, value: "", expires: EXPIRED, path: "/" }
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined
}

/**
 * Keep a `from` parameter to a same-origin path. Rejects anything a browser
 * would resolve to another origin — a full URL, and the protocol-relative
 * `//host` and `/\host` forms — so the page can't be used as an open
 * redirect, along with control characters, which `Location` can't carry.
 */
function sanitizeReturnPath(
    raw: string | null | undefined
): string | undefined {
    if (!raw) return undefined
    for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i)
        if (code < 0x20 || code === 0x7f) return undefined
    }
    if (raw === "/") return raw
    if (!/^\/[^/\\]/.test(raw)) return undefined
    return raw
}

function htmlResponse(html: string): Response {
    return new Response(html, {
        headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            // Belt and braces: the page isn't served in production anyway.
            "x-robots-tag": "noindex, nofollow",
        },
    })
}

const STYLES = `
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body {
    margin: 0 auto;
    padding: 1.5rem 1rem 4rem;
    max-width: 40rem;
    font: 1rem/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui,
        sans-serif;
}
h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
h2 { font-size: 1rem; font-family: ui-monospace, SFMono-Regular, monospace; margin: 0 0 0.25rem; }
p { margin: 0 0 0.75rem; }
code { font-family: ui-monospace, SFMono-Regular, monospace; }
.note { opacity: 0.7; font-size: 0.875rem; }
.experiment { border-top: 1px solid; padding: 1.25rem 0 0.5rem; margin-top: 1.25rem; }
.arms { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.75rem 0; }
.arm {
    min-height: 2.75rem;
    padding: 0 1rem;
    border: 1px solid;
    border-radius: 0.4rem;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
}
.arm[aria-pressed="true"] { background: CanvasText; color: Canvas; font-weight: 600; }
.arm[value=""] { opacity: 0.7; }
.paths { margin: 0.5rem 0 0; padding: 0; list-style: none; }
.paths li { margin: 0 0 0.25rem; }
.back { display: inline-block; margin-bottom: 1rem; font-weight: 600; }
`

function renderPage({
    experiments: activeExperiments,
    cookies,
    returnPath,
    env,
}: {
    experiments: Experiment[]
    cookies: Record<string, string | undefined>
    returnPath: string | undefined
    env: string
}): string {
    const back = returnPath
        ? `<p><a class="back" href="${escapeHtml(returnPath)}">&larr; Back to <code>${escapeHtml(returnPath)}</code></a></p>`
        : ""

    const body = activeExperiments.length
        ? activeExperiments
              .map((e) => renderExperiment(e, cookies[e.id], returnPath))
              .join("\n") + renderClearAll(returnPath)
        : `<p class="note">No experiments are currently active.</p>`

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Experiment arms</title>
<style>${STYLES}</style>
</head>
<body>
<h1>Experiment arms</h1>
<p class="note">
    Pick an arm to set its <code>exp-</code> cookie, then open the page you
    want to check &mdash; it is rendered in that arm from the first byte.
    This page is not available in production (currently <code>${escapeHtml(env)}</code>).
</p>
${back}
${body}
</body>
</html>
`
}

function renderExperiment(
    experiment: Experiment,
    cookieValue: string | undefined,
    returnPath: string | undefined
): string {
    const currentArm = cookieValue
        ? experiment.getArmById(cookieValue)
        : undefined
    const current = currentArm
        ? `<code>${escapeHtml(currentArm.id)}</code>`
        : cookieValue
          ? `<code>${escapeHtml(cookieValue)}</code> (not an arm of this experiment)`
          : "not assigned"

    const arms = experiment.arms
        .map(
            (arm) =>
                `<button class="arm" type="submit" name="arm" value="${escapeHtml(arm.id)}" aria-pressed="${arm.id === currentArm?.id}">${escapeHtml(arm.id)} <span class="note">${formatFraction(arm.fraction)}</span></button>`
        )
        .join("\n            ")

    const paths = experiment.paths
        .map(
            (path) =>
                `<li><a href="${escapeHtml(path)}">${escapeHtml(path)}</a></li>`
        )
        .join("\n            ")

    return `<section class="experiment">
    <h2>${escapeHtml(experiment.id)}</h2>
    <p class="note">Currently ${current} &middot; expires ${escapeHtml(experiment.expires.toISOString().slice(0, 10))}</p>
    <form method="post">
        ${hiddenReturnPath(returnPath)}
        <input type="hidden" name="experiment" value="${escapeHtml(experiment.id)}">
        <div class="arms">
            ${arms}
            <button class="arm" type="submit" name="arm" value="">Clear</button>
        </div>
    </form>
    <details>
        <summary class="note">${experiment.paths.length} page${experiment.paths.length === 1 ? "" : "s"} in this experiment</summary>
        <ul class="paths">
            ${paths}
        </ul>
    </details>
</section>`
}

function renderClearAll(returnPath: string | undefined): string {
    return `
<form class="experiment" method="post">
    ${hiddenReturnPath(returnPath)}
    <button class="arm" type="submit" name="action" value="${CLEAR_ALL_ACTION}">
        Clear all experiment cookies
    </button>
</form>`
}

function hiddenReturnPath(returnPath: string | undefined): string {
    return returnPath
        ? `<input type="hidden" name="from" value="${escapeHtml(returnPath)}">`
        : ""
}

function formatFraction(fraction: number): string {
    return `${Math.round(fraction * 100)}%`
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}
