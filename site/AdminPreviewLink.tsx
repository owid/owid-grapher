import { useIsClient } from "usehooks-ts"

import { ADMIN_BASE_URL } from "../settings/clientSettings.js"
import { hasAdminCookie } from "./adminCookie.js"

/**
 * Takes staff from a live data page or multi-dim to its admin preview, which is
 * where internal comments live. Without it the preview is effectively
 * unreachable: you notice a problem on the public page and there is no link
 * from there to the place you can flag it.
 *
 * One route serves both page types, so the slug in the address bar is all this
 * needs - a chart slug and a multi-dim slug both resolve there.
 *
 * Public visitors never have the cookie and so never see this. Nothing about
 * commenting is loaded either way; this is a link, not the tool.
 */
export function AdminPreviewLink({
    slug,
    isPreviewing,
}: {
    slug: string | null | undefined
    isPreviewing?: boolean
}): React.ReactElement | null {
    // The cookie only exists in the browser, so this can't be server-rendered:
    // baking it would put it on the public page for everyone.
    const isClient = useIsClient()
    // No point offering it on a preview - that is where the link goes
    if (isPreviewing || !isClient || !slug || !hasAdminCookie()) return null

    return (
        <div className="admin-preview-link">
            <a
                href={`${ADMIN_BASE_URL}/admin/grapher/${slug}`}
                title="Open this page in the admin, where you can leave comments on its metadata"
                target="_blank"
                rel="noopener"
            >
                Comments
            </a>
        </div>
    )
}
