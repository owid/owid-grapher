import { createRoot } from "react-dom/client"
import { isInIFrame } from "@ourworldindata/utils"
import { LabsBar } from "./LabsBar.js"

// Hiding the bar lasts for the rest of the browser session
const LABS_BAR_HIDDEN_KEY = "labsBarHidden"

function wasHiddenThisSession(): boolean {
    try {
        return sessionStorage.getItem(LABS_BAR_HIDDEN_KEY) !== null
    } catch {
        return false
    }
}

function rememberHidden(): void {
    try {
        sessionStorage.setItem(LABS_BAR_HIDDEN_KEY, "1")
    } catch {
        // Storage can be unavailable (private mode); then it only hides here
    }
}

export function runLabsBar(): void {
    // Embedded charts load the same bundle; only show the bar on full pages
    if (isInIFrame() || wasHiddenThisSession()) return

    // In the main bundle rather than a lazy chunk: a second lazy chunk (AI mode
    // is the first) makes the build split out shared chunks, which the archive
    // baker doesn't know about, and the bake fails
    const container = document.createElement("div")
    document.body.appendChild(container)
    createRoot(container).render(<LabsBar onHide={rememberHidden} />)
}
