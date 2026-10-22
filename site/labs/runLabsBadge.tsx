import { createRoot } from "react-dom/client"
import { LabsBadge } from "./LabsBadge.js"

export function runLabsBadge(): void {
    // Embedded charts load the same bundle; only show the badge on full pages
    if (window.self !== window.top) return

    const container = document.createElement("div")
    document.body.appendChild(container)
    createRoot(container).render(<LabsBadge />)
}
