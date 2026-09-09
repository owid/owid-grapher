// DIAGNOSTIC ONLY - DO NOT MERGE.
//
// Reports the recursive frames of the translated-DOM RangeError from devices
// where no debugger is reachable: BrowserStack Live gives a console at best,
// and the crash does not reproduce on desktop, where V8's deeper stack
// survives the same recursion.
//
// Renders the report onto the page so it can be read or screenshotted on the
// device, and mirrors it to Sentry so it can be read from a desk.

import * as Sentry from "@sentry/react"

const OVERLAY_ID = "translation-crash-probe"
const VERBATIM_FRAMES = 12
const UNIQUE_FRAMES = 6
// Long enough for a function name plus a bundle offset, short enough that the
// overlay stays screenshottable on a phone.
const MAX_FRAME_LENGTH = 110

interface StackReport {
    totalFrames: number
    top: string[]
    repeated: string[]
}

function buildReport(stack: string): StackReport {
    // Frame 0 is the error message itself, not a frame.
    const frames = stack
        .split("\n")
        .slice(1)
        .map((line) => line.trim().slice(0, MAX_FRAME_LENGTH))
        .filter(Boolean)

    const counts = new Map<string, number>()
    for (const frame of frames) {
        counts.set(frame, (counts.get(frame) ?? 0) + 1)
    }

    const repeated = [...counts]
        .sort(([, a], [, b]) => b - a)
        .slice(0, UNIQUE_FRAMES)
        .map(([frame, n]) => `${n}x ${frame}`)

    return {
        totalFrames: frames.length,
        top: frames.slice(0, VERBATIM_FRAMES),
        repeated,
    }
}

function formatReport(report: StackReport): string {
    return [
        `frames captured: ${report.totalFrames}`,
        "",
        "-- top of stack, in order --",
        ...report.top,
        "",
        "-- most repeated frames --",
        ...report.repeated,
    ].join("\n")
}

function showOverlay(text: string): void {
    if (document.getElementById(OVERLAY_ID)) return

    const pre = document.createElement("pre")
    pre.id = OVERLAY_ID
    // Keep the translator away from the one element we need to read verbatim.
    pre.setAttribute("translate", "no")
    pre.className = "notranslate"
    pre.textContent = text
    pre.style.cssText = [
        "position:fixed",
        "inset:0 0 auto 0",
        "z-index:2147483647",
        "margin:0",
        "padding:8px",
        "max-height:70vh",
        "overflow:auto",
        "background:#111",
        "color:#0f0",
        "font:10px/1.35 ui-monospace,monospace",
        "white-space:pre-wrap",
        "word-break:break-all",
        "-webkit-user-select:text",
        "user-select:text",
    ].join(";")

    document.body.appendChild(pre)
}

export const runTranslationCrashProbe = (): void => {
    // Both V8 and JavaScriptCore capture only 10 frames by default, far too
    // few to see the recursive cycle.
    Error.stackTraceLimit = 500

    let reported = false

    window.addEventListener(
        "error",
        (event: ErrorEvent) => {
            // The crash arrives in bursts; only the first one is interesting,
            // and capturing every one would flood Sentry.
            if (reported) return

            const error: unknown = event.error
            if (!(error instanceof RangeError) || !error.stack) return

            reported = true
            const report = buildReport(error.stack)
            const text = formatReport(report)

            Sentry.captureMessage("translation crash probe", {
                level: "info",
                extra: {
                    report: text,
                    fullStack: error.stack.slice(0, 20000),
                },
            })

            showOverlay(text)
        },
        // Capture phase, so this runs before Sentry's own handler swallows it.
        true
    )
}
