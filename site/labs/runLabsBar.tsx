import { createRoot } from "react-dom/client"
import { isInIFrame } from "@ourworldindata/utils"

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

    // A chunk of its own, so the bar adds nothing to the bundle every page loads
    import("./LabsBar.js")
        .then(({ LabsBar }) => {
            const container = document.createElement("div")
            document.body.appendChild(container)
            createRoot(container).render(<LabsBar onHide={rememberHidden} />)
        })
        .catch((error) => console.warn("The Labs bar didn't load", error))
}
