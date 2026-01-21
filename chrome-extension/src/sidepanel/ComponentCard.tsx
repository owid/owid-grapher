import { useState, useCallback } from "react"
import type { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import ArticleBlock from "@owid/site/gdocs/components/ArticleBlock.js"
import { enrichedBlockToRawBlock } from "@owid/db/model/Gdoc/enrichedToRaw.js"
import { OwidRawGdocBlockToArchieMLString } from "@owid/db/model/Gdoc/rawToArchie.js"
import type { ComponentMetadata } from "./componentGalleryExamples.js"

interface ComponentCardProps {
    blockType: string
    enrichedBlock: OwidEnrichedGdocBlock
    metadata?: ComponentMetadata
}

export function ComponentCard({
    blockType,
    enrichedBlock,
    metadata,
}: ComponentCardProps) {
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

    const requiredFields = metadata?.fields.filter((f) => f.required) ?? []
    const optionalFields = metadata?.fields.filter((f) => !f.required) ?? []

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
            {metadata && (
                <div className="component-card__info">
                    <p className="component-card__description">
                        {metadata.description}
                    </p>
                    {metadata.fields.length > 0 && (
                        <div className="component-card__fields">
                            {requiredFields.length > 0 && (
                                <div className="component-card__fields-group">
                                    <span className="component-card__fields-label component-card__fields-label--required">
                                        Required:
                                    </span>
                                    {requiredFields.map((field) => (
                                        <div
                                            key={field.name}
                                            className="component-card__field component-card__field--required"
                                        >
                                            <code className="component-card__field-name">
                                                {field.name}
                                            </code>
                                            <span className="component-card__field-description">
                                                {field.description}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {optionalFields.length > 0 && (
                                <div className="component-card__fields-group">
                                    <span className="component-card__fields-label component-card__fields-label--optional">
                                        Optional:
                                    </span>
                                    {optionalFields.map((field) => (
                                        <div
                                            key={field.name}
                                            className="component-card__field component-card__field--optional"
                                        >
                                            <code className="component-card__field-name">
                                                {field.name}
                                            </code>
                                            <span className="component-card__field-description">
                                                {field.description}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            <div className="component-card__preview">
                <ArticleBlock b={enrichedBlock} />
            </div>
        </div>
    )
}
