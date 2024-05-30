import React from "react"
import { observer } from "mobx-react"
import { KeyChartLevel, DbChartTagJoin } from "@ourworldindata/utils"

import { Link } from "./Link.js"
import Tippy from "@tippyjs/react"
import { TagBucketSortingIcon } from "./TagBucketSortingIcon.js"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faClock } from "@fortawesome/free-solid-svg-icons"

@observer
export class TagBadge extends React.Component<{
    tag: DbChartTagJoin
    onToggleKey?: () => void
    onApprove?: () => void
    searchHighlight?: (text: string) => string | React.ReactElement
}> {
    levelToDesc(level?: KeyChartLevel) {
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

    render() {
        const { tag, searchHighlight, onToggleKey, onApprove } = this.props
        const isPending = !tag.isApproved && onApprove
        const keyChartLevelDesc =
            tag.keyChartLevel === KeyChartLevel.None
                ? "Not a key chart, will be hidden in the all charts block of the topic page"
                : `Chart will show ${this.levelToDesc(
                      tag.keyChartLevel
                  )} of the all charts block on the topic page`
        return (
            <span
                className={cx("TagBadge", {
                    "TagBadge--is-pending": isPending,
                })}
            >
                <Link className="TagBadge__name" to={`/tags/${tag.id}`}>
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
                        <span
                            className="TagBadge__sorting"
                            onClick={onToggleKey}
                        >
                            <TagBucketSortingIcon level={tag.keyChartLevel} />
                        </span>
                    </Tippy>
                ) : null}
            </span>
        )
    }
}
