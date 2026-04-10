import { useState } from "react"
import * as React from "react"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"

const MAX_LEAD_TEXT_BLOCKS = 2

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
}: {
    blocks: OwidEnrichedGdocBlock[]
    children?: React.ReactNode
}) => {
    const [expanded, setExpanded] = useState(false)
    const { leadBlocks, trailingBlocks } = splitAfterNthTextBlock(
        blocks,
        MAX_LEAD_TEXT_BLOCKS
    )

    const hasMore = trailingBlocks.length > 0 || children

    return (
        <div className="expandable-text">
            <div className="expandable-text__lead">
                <ArticleBlocks blocks={leadBlocks} interactiveImages={false} />
                {hasMore && !expanded && (
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
            {expanded && (
                <>
                    <ArticleBlocks
                        blocks={trailingBlocks}
                        interactiveImages={false}
                    />
                    {children}
                </>
            )}
        </div>
    )
}
