import cx from "clsx"
import { faChevronRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { LatestType } from "@ourworldindata/types"
import {
    buildLatestPagePath,
    latestTypeLabelPlural,
} from "../../latest/latestUtils.js"

/**
 * Breadcrumb for a standalone page that also appears in the /latest feed —
 * data insights and announcements. Links back to the feed filtered to the
 * page's own kind, so it doubles as the page's "what kind of thing is this"
 * label. Hidden on small screens (see CSS).
 */
export default function LatestBreadcrumb({
    className,
    latestType,
    title,
}: {
    className?: string
    latestType: LatestType
    title: string
}) {
    return (
        <div className={cx("latest-breadcrumb", className)}>
            <a href={buildLatestPagePath(latestType)}>
                {latestTypeLabelPlural(latestType)}
            </a>
            <FontAwesomeIcon icon={faChevronRight} />
            <span>{title}</span>
        </div>
    )
}
