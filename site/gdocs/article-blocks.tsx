import React from "react"
import ArticleElement from "./article-element.js"
import { OwidArticleBlock } from "./gdoc-types.js"

export const ArticleBlocks = ({ blocks }: { blocks: OwidArticleBlock[] }) => (
    <>
        {blocks.map((block: OwidArticleBlock, i: number) => {
            return <ArticleElement key={i} d={block} />
        })}
    </>
)
