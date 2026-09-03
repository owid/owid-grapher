import { useRef } from "react"
import cx from "clsx"
import {
    BESPOKE_METADATA_FALLBACK_TITLE,
    BespokeMetadataHeading,
    BespokeMetadataKeyData,
    BespokeMetadataSections,
    MetadataBoxCollapseButton,
    MetadataBoxExpander,
    SimpleMarkdownText,
} from "@ourworldindata/components"
import { BespokeMetadata } from "@ourworldindata/types"
import { splitDescriptionKey } from "../../datapageUtils.js"

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

    // Only the start of a long descriptionKey is shown above the fold; the
    // rest goes inside the <details> so that it works without JavaScript and
    // browsers auto-expand it when in-page search matches hidden text.
    const { preview: descriptionKeyPreview, remainder: descriptionKeyRest } =
        splitDescriptionKey(metadata.descriptionKey ?? "")

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
