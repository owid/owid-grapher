import { Fragment, type ReactNode } from "react"
import ArticleBlock from "./ArticleBlock.js"
import {
    getIntroEndIndex,
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
 * @param afterIntro - Optional element rendered as a sibling grid item after
 * the intro, i.e. before the first heading or table of contents that follows
 * the opening text. It is responsible for its own grid placement classes.
 * @constructor
 */
export const ArticleBlocks = ({
    blocks,
    containerType = "default",
    toc,
    shouldRenderLinks = true,
    interactiveImages = true,
    automaticSubscribeBanner = false,
    afterIntro,
}: {
    blocks: OwidEnrichedGdocBlock[]
    containerType?: Container
    toc?: TocHeadingWithSupertitle[]
    shouldRenderLinks?: boolean
    interactiveImages?: boolean
    automaticSubscribeBanner?: boolean
    afterIntro?: ReactNode
}) => {
    const blocksToRender = automaticSubscribeBanner
        ? injectAutomaticSubscribeBanner(blocks)
        : blocks

    const afterIntroIndex = afterIntro ? getIntroEndIndex(blocksToRender) : -1

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
                        {i === afterIntroIndex ? afterIntro : null}
                    </Fragment>
                )
            })}
        </>
    )
}
