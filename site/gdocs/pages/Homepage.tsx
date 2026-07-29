import * as React from "react"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import { OwidGdocHomepageContent } from "@ourworldindata/types"
import { HomepageTopicAreas } from "./HomepageTopicAreas.js"

export interface HomepageProps {
    content: OwidGdocHomepageContent
}

// Prototype: the "Explore the data" (key-indicator-collection) and "Data
// explorers" (explorer-tiles) sections are replaced by the per-area sections
// rendered by HomepageTopicAreas below.
const HIDDEN_HOMEPAGE_BLOCK_TYPES = new Set([
    "key-indicator-collection",
    "explorer-tiles",
])

export const Homepage = (props: HomepageProps): React.ReactElement => {
    const { content } = props
    const blocks = content.body.filter(
        (block) => !HIDDEN_HOMEPAGE_BLOCK_TYPES.has(block.type)
    )

    return (
        <div className="grid grid-cols-12-full-width">
            <ArticleBlocks blocks={blocks} />
            <HomepageTopicAreas />
        </div>
    )
}
