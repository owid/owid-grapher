import { useState, useCallback } from "react"
import type { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import ArticleBlock from "@owid/site/gdocs/components/ArticleBlock.js"
import { enrichedBlockToRawBlock } from "@owid/db/model/Gdoc/enrichedToRaw.js"
import { OwidRawGdocBlockToArchieMLString } from "@owid/db/model/Gdoc/rawToArchie.js"

interface ComponentCardProps {
    blockType: string
    enrichedBlock: OwidEnrichedGdocBlock
}

export function ComponentCard({ blockType, enrichedBlock }: ComponentCardProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = useCallback(async () => {
        try {
            // Convert enriched block to raw block, then to ArchieML string
            const rawBlock = enrichedBlockToRawBlock(enrichedBlock)
            const archieMlString = OwidRawGdocBlockToArchieMLString(rawBlock)

            await navigator.clipboard.writeText(archieMlString)
            setCopied(true)

            // Reset copied state after 2 seconds
            setTimeout(() => setCopied(false), 2000)
        } catch (error) {
            console.error("Failed to copy ArchieML:", error)
        }
    }, [enrichedBlock])

    return (
        <div className="component-card">
            <div className="component-card__header">
                <h3 className="component-card__title">{blockType}</h3>
                <button
                    className={`component-card__copy-button ${copied ? "component-card__copy-button--copied" : ""}`}
                    onClick={handleCopy}
                    title="Copy ArchieML syntax"
                >
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>
            <div className="component-card__preview">
                <ArticleBlock b={enrichedBlock} />
            </div>
        </div>
    )
}
