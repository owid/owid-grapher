import { useState } from "react"
import * as React from "react"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"
import { Container, getLayout } from "../gdocs/components/layout.js"
import cx from "classnames"

const MAX_LEAD_TEXT_BLOCKS = 2

// Splits after the Nth `text` block. Non-text blocks (lists, headings,
// images, CTAs…) are kept with whichever side they happen to fall on — the
// design target is "show two paragraphs of lead text", so we count
// paragraphs and let everything else ride along. If the input has fewer
// than `n` text blocks, the entire input becomes lead and `trailingBlocks`
// is empty.
function splitAfterNthTextBlock(
    blocks: OwidEnrichedGdocBlock[],
    n: number
): {
    leadBlocks: OwidEnrichedGdocBlock[]
    trailingBlocks: OwidEnrichedGdocBlock[]
} {
    let textCount = 0
    for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].type === "text") {
            textCount++
            if (textCount >= n) {
                return {
                    leadBlocks: blocks.slice(0, i + 1),
                    trailingBlocks: blocks.slice(i + 1),
                }
            }
        }
    }
    return { leadBlocks: blocks, trailingBlocks: [] }
}

export const ExpandableText = ({
    blocks,
    children,
    containerType,
    alwaysExpanded,
}: {
    blocks: OwidEnrichedGdocBlock[]
    children?: React.ReactNode
    containerType?: Container
    /** Render fully expanded with no Read more toggle. Used when the caller
     * needs the same DOM/layout structure as the collapsible variant — e.g.
     * the standalone announcement preview, which mirrors the feed card so
     * grid layout and margin collapsing match. */
    alwaysExpanded?: boolean
}) => {
    const [expanded, setExpanded] = useState(false)
    const isExpanded = alwaysExpanded || expanded
    const { leadBlocks, trailingBlocks } = splitAfterNthTextBlock(
        blocks,
        MAX_LEAD_TEXT_BLOCKS
    )

    const hasMore = trailingBlocks.length > 0 || children

    return (
        <div className="expandable-text">
            <div
                className={cx("expandable-text__lead", {
                    "expandable-text__lead--collapsed": !isExpanded,
                })}
            >
                <ArticleBlocks
                    blocks={leadBlocks}
                    interactiveImages={false}
                    containerType={containerType}
                />
                {hasMore && !isExpanded && (
                    <>
                        {" "}
                        <button
                            className="expandable-text__toggle"
                            onClick={() => setExpanded(true)}
                        >
                            Read more
                        </button>
                    </>
                )}
            </div>
            {isExpanded && (
                <div className={getLayout("expandable-text", containerType)}>
                    <ArticleBlocks
                        blocks={trailingBlocks}
                        interactiveImages={false}
                        containerType={containerType}
                    />
                    <div className={getLayout("default", containerType)}>
                        {children}
                    </div>
                </div>
            )}
        </div>
    )
}
