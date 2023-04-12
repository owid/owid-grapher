import React from "react"
import ArticleBlock, { Container } from "./ArticleBlock.js"
import {
    OwidEnrichedGdocBlock,
    TocHeadingWithTitleSupertitle,
} from "@ourworldindata/utils"

export const ArticleBlocks = ({
    blocks,
    containerType = "default",
    toc,
}: {
    blocks: OwidEnrichedGdocBlock[]
    containerType?: Container
    toc?: TocHeadingWithTitleSupertitle[]
}) => (
    <>
        {blocks.map((block: OwidEnrichedGdocBlock, i: number) => {
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
