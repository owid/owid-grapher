import { createRoot } from "react-dom/client"
import { isInIFrame } from "@ourworldindata/utils"
import { LabsBar, LABS_BAR_HIDDEN_KEY } from "./LabsBar.js"

function wasHiddenThisSession(): boolean {
    try {
        return sessionStorage.getItem(LABS_BAR_HIDDEN_KEY) !== null
    } catch {
        return false
    }
}

export function runLabsBar(): void {
    // Embedded charts load the same bundle; only show the bar on full pages
    if (isInIFrame() || wasHiddenThisSession()) return

    const container = document.createElement("div")
    document.body.appendChild(container)
    createRoot(container).render(<LabsBar />)
}
