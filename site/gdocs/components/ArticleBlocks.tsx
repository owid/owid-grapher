import { Fragment, type ReactNode } from "react"
import ArticleBlock from "./ArticleBlock.js"
import {
    getIntroAsideInsertionIndex,
    injectAutomaticSubscribeBanner,
} from "./gdocComponentUtils.js"
import { Container } from "./layout.js"
import {
    OwidEnrichedGdocBlock,
    TocHeadingWithSupertitle,
} from "@ourworldindata/utils"

/**
 * Renders a list of article blocks.
 *
 * @param blocks
 * @param containerType
 * @param toc
 * @param shouldRenderLinks - Won't render <a> elements when false. Useful to avoid
 * invalid nested links.
 * @param introAside - Optional element rendered as a sibling grid item just
 * after the first paragraph of the body, so that it sits in the right rail
 * level with the intro. It is responsible for its own grid placement classes.
 * @constructor
 */
export const ArticleBlocks = ({
    blocks,
    containerType = "default",
    toc,
    shouldRenderLinks = true,
    interactiveImages = true,
    automaticSubscribeBanner = false,
    introAside,
}: {
    blocks: OwidEnrichedGdocBlock[]
    containerType?: Container
    toc?: TocHeadingWithSupertitle[]
    shouldRenderLinks?: boolean
    interactiveImages?: boolean
    automaticSubscribeBanner?: boolean
    introAside?: ReactNode
}) => {
    const blocksToRender = automaticSubscribeBanner
        ? injectAutomaticSubscribeBanner(blocks)
        : blocks

    const introAsideIndex = introAside
        ? getIntroAsideInsertionIndex(blocksToRender)
        : -1

    return (
        <>
            {blocksToRender.map((block: OwidEnrichedGdocBlock, i: number) => {
                const articleBlock = (
                    <ArticleBlock
                        b={block}
                        containerType={containerType}
                        toc={toc}
                        shouldRenderLinks={shouldRenderLinks}
                        interactiveImages={interactiveImages}
                    />
                )
                return (
                    <Fragment key={i}>
                        {articleBlock}
                        {i === introAsideIndex ? introAside : null}
                    </Fragment>
                )
            })}
        </>
    )
}
