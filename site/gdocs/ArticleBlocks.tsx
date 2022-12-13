import React from "react"
import ArticleBlock from "./ArticleBlock.js"
import {
    OwidArticleBlock,
    TocHeadingWithTitleSupertitle,
} from "@ourworldindata/utils"

export const ArticleBlocks = ({
    blocks,
    toc,
}: {
    blocks: OwidArticleBlock[]
    toc?: TocHeadingWithTitleSupertitle[]
}) => (
    <>
        {blocks.map((block: OwidArticleBlock, i: number) => {
            return <ArticleBlock key={i} d={block} toc={toc} />
        })}
    </>
)
