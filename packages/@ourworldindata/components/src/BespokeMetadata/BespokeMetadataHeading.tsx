import { BespokeMetadataWithProvenance } from "@ourworldindata/types"
import cx from "clsx"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"

/** A bespoke viz's indicator title, its variant, and the short description under both */
export function BespokeMetadataHeading({
    metadata,
    headingLevel = "h2",
    className,
}: {
    metadata: BespokeMetadataWithProvenance
    headingLevel?: "h2" | "h3"
    className?: string
}): React.ReactElement {
    const Heading = headingLevel

    return (
        <div className={cx("bespoke-metadata-heading", className)}>
            <Heading className="bespoke-metadata-heading__title">
                {metadata.title}
                {metadata.titleVariant && (
                    <span className="bespoke-metadata-heading__title-variant">
                        {metadata.titleVariant}
                    </span>
                )}
            </Heading>
            {metadata.descriptionShort && (
                <div className="bespoke-metadata-heading__description">
                    <SimpleMarkdownText text={metadata.descriptionShort} />
                </div>
            )}
        </div>
    )
}
