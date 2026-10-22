import { createRoot } from "react-dom/client"
import { isInIFrame } from "@ourworldindata/utils"
import { LabsBadge, LABS_BADGE_HIDDEN_KEY } from "./LabsBadge.js"

function wasHiddenThisSession(): boolean {
    try {
        return sessionStorage.getItem(LABS_BADGE_HIDDEN_KEY) !== null
    } catch {
        return false
    }
}

export function runLabsBadge(): void {
    // Embedded charts load the same bundle; only show the badge on full pages
    if (isInIFrame() || wasHiddenThisSession()) return

    const container = document.createElement("div")
    document.body.appendChild(container)
    createRoot(container).render(<LabsBadge />)
}
