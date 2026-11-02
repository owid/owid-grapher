import { useRef } from "react"
import cx from "clsx"
import {
    BESPOKE_METADATA_TITLE,
    BespokeMetadataKeyData,
    BespokeMetadataSections,
    MetadataBoxCollapseButton,
    MetadataBoxExpander,
    SimpleMarkdownText,
} from "@ourworldindata/components"
import { BespokeMetadata } from "@ourworldindata/types"

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

    return (
        <div className={cx("metadata-box", "bespoke-metadata-box", className)}>
            <MetadataBoxCollapseButton detailsRef={detailsRef} />
            <h2 className="bespoke-metadata-box__title">
                {BESPOKE_METADATA_TITLE}
            </h2>
            <BespokeMetadataKeyData metadata={metadata} />
            <MetadataBoxExpander
                detailsRef={detailsRef}
                showMoreLabel="More about this data"
                preview={
                    metadata.descriptionKey ? (
                        <SimpleMarkdownText text={metadata.descriptionKey} />
                    ) : undefined
                }
            >
                <BespokeMetadataSections
                    metadata={metadata}
                    citationUrl={citationUrl}
                    pageCitation={pageCitation}
                />
            </MetadataBoxExpander>
        </div>
    )
}
