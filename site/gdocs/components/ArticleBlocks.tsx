import ArticleBlock from "./ArticleBlock.js"
import { injectAutomaticSubscribeBar } from "./gdocComponentUtils.js"
import { Container } from "./layout.js"
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
    interactiveImages = true,
    automaticSubscribeBar = false,
}: {
    blocks: OwidEnrichedGdocBlock[]
    containerType?: Container
    toc?: TocHeadingWithTitleSupertitle[]
    shouldRenderLinks?: boolean
    interactiveImages?: boolean
    automaticSubscribeBar?: boolean
}) => {
    const blocksToRender = automaticSubscribeBar
        ? injectAutomaticSubscribeBar(blocks)
        : blocks

    return (
        <>
            {blocksToRender.map((block: OwidEnrichedGdocBlock, i: number) => {
                return (
                    <ArticleBlock
                        key={i}
                        b={block}
                        containerType={containerType}
                        toc={toc}
                        shouldRenderLinks={shouldRenderLinks}
                        interactiveImages={interactiveImages}
                    />
                )
            })}
        </>
    )
}
