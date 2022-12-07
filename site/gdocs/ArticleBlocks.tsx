import React from "react"
import ArticleBlock, { Container } from "./ArticleBlock.js"
import {
    OwidEnrichedArticleBlock,
    TocHeadingWithTitleSupertitle,
} from "@ourworldindata/utils"

export const ArticleBlocks = ({
    blocks,
    containerType = "default",
    toc,
}: {
    blocks: OwidEnrichedArticleBlock[]
    containerType?: Container
    toc?: TocHeadingWithTitleSupertitle[]
}) => (
    <>
        {blocks.map((block: OwidEnrichedArticleBlock, i: number) => {
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
