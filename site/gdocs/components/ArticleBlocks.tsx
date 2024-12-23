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
 * @param shouldRenderLinks - Won't render <a> elements when false. Useful to avoid
 * invalid nested links.
 * @constructor
 */
export const ArticleBlocks = ({
    blocks,
    containerType = "default",
    toc,
    shouldRenderLinks = true,
}: {
    blocks: OwidEnrichedGdocBlock[]
    containerType?: Container
    toc?: TocHeadingWithTitleSupertitle[]
    shouldRenderLinks?: boolean
}) => (
    <>
        {blocks.map((block: OwidEnrichedGdocBlock, i: number) => {
            return (
                <ArticleBlock
                    key={i}
                    b={block}
                    containerType={containerType}
                    toc={toc}
                    shouldRenderLinks={shouldRenderLinks}
                />
            )
        })}
    </>
)
