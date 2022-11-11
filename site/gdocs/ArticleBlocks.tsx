import React from "react"
import ArticleBlock from "./ArticleBlock.js"
import { OwidEnrichedArticleBlock } from "@ourworldindata/utils"

export const ArticleBlocks = ({
    blocks,
}: {
    blocks: OwidEnrichedArticleBlock[]
}) => {
    return (
        <>
            {blocks.map((block: OwidEnrichedArticleBlock, i: number) => {
                return <ArticleBlock key={i} b={block} />
            })}
        </>
    )
}
