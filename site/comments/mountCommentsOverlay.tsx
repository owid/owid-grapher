import { createRoot } from "react-dom/client"
import { CommentsOverlay } from "./CommentsOverlay.js"
import { SiteQueryClientProvider } from "../SiteQueryClientProvider.js"
import { getCommentPageContext } from "./commentContext.js"

/**
 * Mounts the overlay on an admin preview - chart page, data page or multi-dim.
 * Loaded via dynamic import from runSiteFooterScripts so none of this code (or
 * react-query) ends up in the public site chunk.
 */
export function mountCommentsOverlay(): void {
    const context = getCommentPageContext()
    if (!context) return
    const container = document.createElement("div")
    document.body.appendChild(container)
    createRoot(container).render(
        <SiteQueryClientProvider>
            <CommentsOverlay context={context} />
        </SiteQueryClientProvider>
    )
}
