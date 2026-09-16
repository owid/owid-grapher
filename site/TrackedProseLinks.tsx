import { type ReactNode } from "react"
import { SiteAnalytics } from "./SiteAnalytics.js"

const analytics = new SiteAnalytics()

/**
 * Logs clicks on links inside rendered markdown prose (whose anchors can't
 * carry a data-track-note), with the href as the label.
 */
export default function TrackedProseLinks({
    note,
    children,
    className,
}: {
    note: string
    children: ReactNode
    className?: string
}) {
    return (
        <div
            className={className}
            onClick={(e) => {
                const anchor = (e.target as HTMLElement).closest("a")
                if (!anchor) return
                analytics.logSiteClick(note, anchor.getAttribute("href") ?? "")
            }}
        >
            {children}
        </div>
    )
}
