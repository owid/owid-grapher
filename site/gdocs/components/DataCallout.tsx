import { useContext } from "react"
import { EnrichedBlockDataCallout } from "@ourworldindata/types"
import { AttachmentsContext } from "../AttachmentsContext.js"
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
}: {
    block: EnrichedBlockDataCallout
    containerType?: Container
}) {
    const { linkedCallouts = {} } = useContext(AttachmentsContext)

    const contextValue: DataCalloutContextType = {
        url: block.url,
        entity: block.entity,
        linkedCallouts,
    }

    return (
        <DataCalloutContext.Provider value={contextValue}>
            <div className={getLayout("text", containerType)}>
                {block.content.map((textBlock, index) => (
                    <ArticleBlock key={index} b={textBlock} />
                ))}
            </div>
        </DataCalloutContext.Provider>
    )
}

export default DataCallout
