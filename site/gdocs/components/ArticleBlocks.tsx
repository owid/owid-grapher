import React from "react"
import ArticleBlock, { Container } from "./ArticleBlock.js"
import {
    OwidEnrichedGdocBlock,
    TocHeadingWithTitleSupertitle,
} from "@ourworldindata/utils"

/**
 * Renders a list of article blocks.
 *
 * @param blocks
 * @param containerType
 * @param toc
 * @param renderLinks - Won't render <a> elements when false. Useful to avoid
 * invalid nested links.
 * @constructor
 */
export const ArticleBlocks = ({
    blocks,
    containerType = "default",
    toc,
    renderLinks = true,
}: {
    blocks: OwidEnrichedGdocBlock[]
    containerType?: Container
    toc?: TocHeadingWithTitleSupertitle[]
    renderLinks?: boolean
}) => (
    <>
        {blocks.map((block: OwidEnrichedGdocBlock, i: number) => {
            return (
                <ArticleBlock
                    key={i}
                    b={block}
                    containerType={containerType}
                    toc={toc}
                    renderLinks={renderLinks}
                />
            )
        })}
    </>
)
