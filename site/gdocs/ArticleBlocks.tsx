import React from "react"
import ArticleBlock from "./ArticleBlock.js"
import { OwidArticleBlock, TocHeading } from "@ourworldindata/utils"

export const ArticleBlocks = ({
    blocks,
    toc,
}: {
    blocks: OwidArticleBlock[]
    toc?: TocHeading[]
}) => (
    <>
        {blocks.map((block: OwidArticleBlock, i: number) => {
            return <ArticleBlock key={i} d={block} toc={toc} />
        })}
    </>
)
