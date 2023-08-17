import React from "react"
import { observer } from "mobx-react"
import { KeyChartLevel, Tag } from "@ourworldindata/utils"

import { Link } from "./Link.js"
import Tippy from "@tippyjs/react"
import { TagBucketSortingIcon } from "./TagBucketSortingIcon.js"

export type { Tag }

@observer
export class TagBadge extends React.Component<{
    tag: Tag
    onToggleKey?: () => void
    searchHighlight?: (text: string) => string | JSX.Element
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
        const { tag, searchHighlight, onToggleKey } = this.props
        const keyChartLevelDesc =
            tag.isKeyChart === KeyChartLevel.None
                ? "Not a key chart, will be hidden in the all charts block of the topic page"
                : `Chart will show ${this.levelToDesc(
                      tag.isKeyChart
                  )} of the all charts block on the topic page`

        return (
            <span className="TagBadge">
                <Link className="TagBadge__name" to={`/tags/${tag.id}`}>
                    {searchHighlight ? searchHighlight(tag.name) : tag.name}
                </Link>
                {onToggleKey ? (
                    <Tippy content={`${keyChartLevelDesc} "${tag.name}"`}>
                        <span
                            className="TagBadge__sorting"
                            onClick={onToggleKey}
                        >
                            <TagBucketSortingIcon level={tag.isKeyChart} />
                        </span>
                    </Tippy>
                ) : null}
            </span>
        )
    }
}
