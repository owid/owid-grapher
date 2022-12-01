import React from "react"
import ArticleBlock from "./ArticleBlock.js"
import { OwidEnrichedArticleBlock, TocHeading } from "@ourworldindata/utils"

export const ArticleBlocks = ({
    blocks,
    toc,
}: {
    blocks: OwidEnrichedArticleBlock[]
    toc?: TocHeading[]
}) => (
    <>
        {blocks.map((block: OwidEnrichedArticleBlock, i: number) => {
            return <ArticleBlock key={i} b={block} toc={toc} />
        })}
    </>
)
