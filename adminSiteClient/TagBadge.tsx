import React from "react"
import { observer } from "mobx-react"
import { Tag } from "../clientUtils/owidTypes.js"

import { Link } from "./Link.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faStar } from "@fortawesome/free-solid-svg-icons/faStar"
import Tippy from "@tippyjs/react"

export { Tag }

export const TagBadge = observer(
    class TagBadge extends React.Component<{
        tag: Tag
        onToggleKey?: () => void
        searchHighlight?: (text: string) => string | JSX.Element
    }> {
        render() {
            const { tag, searchHighlight, onToggleKey } = this.props
            const classes = ["TagBadge"]

            if (onToggleKey) {
                classes.push("hasKeyChartSupport")
                if (tag.isKey) classes.push("isKey")
                return (
                    <Tippy
                        content={`${
                            tag.isKey ? "⬇️ Demote from" : "⬆️ Promote to"
                        } key charts on topic "${tag.name}"`}
                    >
                        <span
                            className={classes.join(" ")}
                            onClick={onToggleKey}
                        >
                            {searchHighlight
                                ? searchHighlight(tag.name)
                                : tag.name}
                            {tag.isKey && <FontAwesomeIcon icon={faStar} />}
                        </span>
                    </Tippy>
                )
            } else {
                return (
                    <Link className="TagBadge" to={`/tags/${tag.id}`}>
                        {searchHighlight ? searchHighlight(tag.name) : tag.name}
                    </Link>
                )
            }
        }
    }
)
