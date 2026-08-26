import { useRef } from "react"
import {
    BespokeMetadataKeyData,
    MetadataBoxCollapseButton,
    MetadataBoxExpander,
    SimpleMarkdownText,
} from "@ourworldindata/components"
import { BespokeMetadata } from "@ourworldindata/types"

/** Methods and sources for a bespoke data viz */
export function BespokeMetadataBox({
    metadata,
}: {
    metadata: BespokeMetadata
}) {
    const detailsRef = useRef<HTMLDetailsElement | null>(null)

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
            <MetadataBoxExpander detailsRef={detailsRef}>
                {null}
            </MetadataBoxExpander>
        </div>
    )
}
