import { useRef } from "react"
import {
    BespokeMetadataKeyData,
    BespokeMetadataSections,
    MetadataBoxCollapseButton,
    MetadataBoxExpander,
    SimpleMarkdownText,
} from "@ourworldindata/components"
import { BespokeMetadataWithProvenance } from "@ourworldindata/types"
import { splitDescriptionKey } from "../../datapageUtils.js"

/** Methods and sources for a bespoke data viz */
export function BespokeMetadataBox({
    metadata,
    citationUrl,
}: {
    metadata: BespokeMetadataWithProvenance
    citationUrl?: string
}) {
    const detailsRef = useRef<HTMLDetailsElement | null>(null)

    // Only the start of a long descriptionKey is shown above the fold; the
    // rest goes inside the <details> so that it works without JavaScript and
    // browsers auto-expand it when in-page search matches hidden text.
    const { preview: descriptionKeyPreview, remainder: descriptionKeyRest } =
        splitDescriptionKey(metadata.descriptionKey ?? "")

    return (
        <div className="metadata-box bespoke-metadata-box">
            <MetadataBoxCollapseButton detailsRef={detailsRef} />
            <h2 className="bespoke-metadata-box__title body-2-bold-tight">
                {metadata.title}
                {metadata.titleVariant && (
                    <span className="bespoke-metadata-box__title-variant">
                        {metadata.titleVariant}
                    </span>
                )}
            </h2>
            {metadata.descriptionShort && (
                <div className="bespoke-metadata-box__description">
                    <SimpleMarkdownText text={metadata.descriptionShort} />
                </div>
            )}
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
                />
            </MetadataBoxExpander>
        </div>
    )
}
