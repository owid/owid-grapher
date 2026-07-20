import { createRoot } from "react-dom/client"
import { DataPageCommentsOverlay } from "./DataPageCommentsOverlay.js"
import { SiteQueryClientProvider } from "../SiteQueryClientProvider.js"

/**
 * Mounts the overlay on an admin data page preview. Loaded via dynamic import
 * from runSiteFooterScripts so none of this code (or react-query) ends up in
 * the public site chunk.
 */
export function mountDataPageCommentsOverlay(): void {
    const variableId = window._OWID_GRAPHER_CONFIG?.dimensions?.[0]?.variableId
    if (!variableId) return
    const container = document.createElement("div")
    document.body.appendChild(container)
    createRoot(container).render(
        <SiteQueryClientProvider>
            <DataPageCommentsOverlay variableId={variableId} />
        </SiteQueryClientProvider>
    )
}
