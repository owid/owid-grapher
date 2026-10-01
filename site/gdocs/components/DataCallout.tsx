import { EnrichedBlockDataCallout } from "@ourworldindata/types"
import { Container, getLayout } from "./layout.js"
import ArticleBlock from "./ArticleBlock.js"
import { DataCalloutContext, DataCalloutContextType } from "../utils.js"

/**
 * DataCallout component wraps data-callout block content and provides
 * context for span-callout spans to look up their values.
 */
export function DataCallout({
    block,
    containerType = "default",
    shouldRenderLinks = true,
}: {
    block: EnrichedBlockDataCallout
    containerType?: Container
    shouldRenderLinks?: boolean
}) {
    const contextValue: DataCalloutContextType = {
        url: block.url,
    }

    return (
        <DataCalloutContext.Provider value={contextValue}>
            <div className={getLayout("data-callout", containerType)}>
                {block.content.map((textBlock, index) => (
                    <ArticleBlock
                        key={index}
                        b={textBlock}
                        shouldRenderLinks={shouldRenderLinks}
                    />
                ))}
            </div>
        </DataCalloutContext.Provider>
    )
}

export default DataCallout
