import * as React from "react"
import { EnrichedBlockCallout } from "@ourworldindata/types"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { ArticleBlocks } from "./ArticleBlocks.js"

const iconMap = {
    info: faInfoCircle,
}

export default function Callout({
    className,
    block,
}: {
    className?: string
    block: EnrichedBlockCallout
}) {
    const icon = block.icon ? iconMap[block.icon] : null
    return (
        <div className={className}>
            {icon && <FontAwesomeIcon className="callout-icon" icon={icon} />}
            {block.title ? (
                <h4 className="h4-semibold">{block.title}</h4>
            ) : null}
            <ArticleBlocks blocks={block.text} />
        </div>
    )
}
