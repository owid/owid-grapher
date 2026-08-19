import * as React from "react"
import { observer } from "mobx-react"
import {
    KeyChartLevel,
    DbChartTagJoin,
    TagGraphRole,
} from "@ourworldindata/utils"

import { Link } from "./Link.js"
import Tippy from "@tippyjs/react"
import { TagBucketSortingIcon } from "./TagBucketSortingIcon.js"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faClock } from "@fortawesome/free-solid-svg-icons"
import { TagGraphMarker } from "./TagGraphMarker.js"

interface TagBadgeProps {
    tag: DbChartTagJoin
    onToggleKey?: () => void
    onApprove?: () => void
    searchHighlight?: (text: string) => string | React.ReactElement
    tagGraphRole: TagGraphRole
}

function levelToDesc(level?: KeyChartLevel): string {
    switch (level) {
        case KeyChartLevel.Bottom:
            return "at the bottom"
        case KeyChartLevel.Middle:
            return "in the middle"
        case KeyChartLevel.Top:
            return "at the top"
        default:
            return ""
    }
}

export const TagBadge = observer(function TagBadge({
    tag,
    searchHighlight,
    onToggleKey,
    onApprove,
    tagGraphRole,
}: TagBadgeProps) {
    const isPending = !tag.isApproved && onApprove
    const keyChartLevelDesc =
        tag.keyChartLevel === KeyChartLevel.None
            ? "Not a key chart, will be hidden in the all charts block of the topic page"
            : `Chart will show ${levelToDesc(
                  tag.keyChartLevel
              )} of the all charts block on the topic page`

    return (
        <span
            className={cx("TagBadge", {
                "TagBadge--is-pending": isPending,
                "TagBadge--is-area": tagGraphRole === "area",
                "TagBadge--is-orphan": tagGraphRole === "orphan",
            })}
        >
            <Link className="TagBadge__name" to={`/tags/${tag.id}`}>
                {tagGraphRole !== "descendant" && tagGraphRole && (
                    <TagGraphMarker
                        variant={tagGraphRole}
                        className="TagBadge__graph-icon"
                    />
                )}
                {searchHighlight ? searchHighlight(tag.name) : tag.name}
            </Link>
            {isPending ? (
                <Tippy content="Click to approve">
                    <span className="TagBadge__approve" onClick={onApprove}>
                        <FontAwesomeIcon icon={faClock} />
                    </span>
                </Tippy>
            ) : onToggleKey ? (
                <Tippy content={`${keyChartLevelDesc} "${tag.name}"`}>
                    <span className="TagBadge__sorting" onClick={onToggleKey}>
                        <TagBucketSortingIcon level={tag.keyChartLevel} />
                    </span>
                </Tippy>
            ) : null}
        </span>
    )
})
