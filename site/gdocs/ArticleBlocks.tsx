import React from "react"
import ArticleBlock from "./ArticleBlock.js"
import { OwidRawArticleBlock } from "@ourworldindata/utils"

export const ArticleBlocks = ({
    blocks,
}: {
    blocks: OwidRawArticleBlock[]
}) => (
    <>
        {blocks.map((block: OwidRawArticleBlock, i: number) => {
            return <ArticleBlock key={i} b={block} />
        })}
    </>
)
