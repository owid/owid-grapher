import React from "react"
import ArticleBlock from "./ArticleBlock.js"
import {
    OwidEnrichedArticleBlock,
    TocHeadingWithTitleSupertitle,
} from "@ourworldindata/utils"

export const ArticleBlocks = ({
    blocks,
    toc,
}: {
    blocks: OwidEnrichedArticleBlock[]
    toc?: TocHeadingWithTitleSupertitle[]
}) => (
    <>
        {blocks.map((block: OwidEnrichedArticleBlock, i: number) => {
            return <ArticleBlock key={i} b={block} toc={toc} />
        })}
    </>
)
