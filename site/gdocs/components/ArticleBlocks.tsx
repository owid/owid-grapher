import ArticleBlock from "./ArticleBlock.js"
import { BlockErrorBoundary } from "./BlockErrorBoundary.js"
import { Container, getLayout } from "./layout.js"
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
                <BlockErrorBoundary
                    key={i}
                    className={getLayout("default", containerType)}
                >
                    <ArticleBlock
                        b={block}
                        containerType={containerType}
                        toc={toc}
                        shouldRenderLinks={shouldRenderLinks}
                    />
                </BlockErrorBoundary>
            )
        })}
    </>
)
