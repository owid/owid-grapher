import React from "react"
import ArticleBlock, { Container } from "./ArticleBlock.js"
import {
    OwidEnrichedDocumentBlock,
    TocHeadingWithTitleSupertitle,
} from "@ourworldindata/utils"

export const ArticleBlocks = ({
    blocks,
    containerType = "default",
    toc,
}: {
    blocks: OwidEnrichedDocumentBlock[]
    containerType?: Container
    toc?: TocHeadingWithTitleSupertitle[]
}) => (
    <>
        {blocks.map((block: OwidEnrichedDocumentBlock, i: number) => {
            return (
                <ArticleBlock
                    key={i}
                    b={block}
                    containerType={containerType}
                    toc={toc}
                />
            )
        })}
    </>
)
