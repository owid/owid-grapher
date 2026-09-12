import { type ReactNode } from "react"
import { SiteAnalytics } from "./SiteAnalytics.js"

const analytics = new SiteAnalytics()

/**
 * Tracks clicks on links inside a block of rendered prose.
 *
 * Prose comes out of `SimpleMarkdownText`, so its anchors can't carry a
 * `data-track-note` of their own — and putting one on the wrapper would make the
 * global click handler fire on every click in the block, text included. So this
 * listens on the wrapper but only reports when the click actually landed on a
 * link, sending the href as the label.
 *
 * Used on both data page designs' "What you should know about this indicator"
 * text, so click-through out of that text is measured the same way in each arm.
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
