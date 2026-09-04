import { useRef } from "react"
import cx from "clsx"
import {
    BESPOKE_METADATA_FALLBACK_TITLE,
    BespokeMetadataHeading,
    BespokeMetadataKeyData,
    BespokeMetadataSections,
    getBespokeKeyDataRows,
    MetadataBoxCollapseButton,
    MetadataBoxExpander,
    SimpleMarkdownText,
} from "@ourworldindata/components"
import { BespokeMetadata } from "@ourworldindata/types"
import { splitDescriptionKeyAfterFirstBlock } from "../../datapageUtils.js"

/** Methods and sources for a bespoke data viz */
export function BespokeMetadataBox({
    metadata,
    citationUrl,
    pageCitation,
    className,
}: {
    metadata: BespokeMetadata
    citationUrl?: string
    pageCitation?: string
    className?: string
}) {
    const detailsRef = useRef<HTMLDetailsElement | null>(null)

    const hasKeyData = getBespokeKeyDataRows(metadata).length > 0
    const shouldPreviewDescriptionKey =
        !metadata.descriptionShort && !hasKeyData
    const { preview: descriptionKeyPreview, remainder: descriptionKeyRest } =
        shouldPreviewDescriptionKey
            ? splitDescriptionKeyAfterFirstBlock(metadata.descriptionKey ?? "")
            : { preview: "", remainder: metadata.descriptionKey ?? "" }

    return (
        <div className={cx("metadata-box", "bespoke-metadata-box", className)}>
            <MetadataBoxCollapseButton detailsRef={detailsRef} />
            <BespokeMetadataHeading
                metadata={metadata}
                fallbackTitle={BESPOKE_METADATA_FALLBACK_TITLE}
            />
            <BespokeMetadataKeyData metadata={metadata} />
            <MetadataBoxExpander
                detailsRef={detailsRef}
                preview={
                    descriptionKeyPreview ? (
                        <SimpleMarkdownText text={descriptionKeyPreview} />
                    ) : undefined
                }
            >
                {descriptionKeyRest && (
                    <div className="metadata-box-expander__remainder metadata-box-expander__prose">
                        <SimpleMarkdownText text={descriptionKeyRest} />
                    </div>
                )}
                <BespokeMetadataSections
                    metadata={metadata}
                    citationUrl={citationUrl}
                    pageCitation={pageCitation}
                />
            </MetadataBoxExpander>
        </div>
    )
}
