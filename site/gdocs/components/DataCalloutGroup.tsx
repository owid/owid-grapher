import { EnrichedBlockDataCalloutGroup } from "@ourworldindata/types"
import { Container, getLayout } from "./layout.js"
import ArticleBlock from "./ArticleBlock.js"

/**
 * DataCalloutGroup is a logical container that wraps editorial content
 * (e.g. headings) together with data-callout blocks. During baking,
 * if none of the child data-callouts have data for the current entity,
 * the entire group's content is cleared — hiding the heading too.
 *
 * At render time, it simply renders its children; the visibility logic
 * has already been applied server-side.
 */
export function DataCalloutGroup({
    block,
    containerType = "default",
}: {
    block: EnrichedBlockDataCalloutGroup
    containerType?: Container
}) {
    return (
        <div className={getLayout("data-callout-group", containerType)}>
            {block.content.map((child, index) => (
                <ArticleBlock key={index} b={child} />
            ))}
        </div>
    )
}

export default DataCalloutGroup
