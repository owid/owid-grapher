import { BespokeMetadata } from "@ourworldindata/types"
import cx from "clsx"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"

export const BESPOKE_METADATA_FALLBACK_TITLE = "About this data and our methods"

/** A bespoke viz's indicator title, its variant, and the short description under both */
export function BespokeMetadataHeading({
    metadata,
    fallbackTitle,
    headingLevel = "h2",
    className,
}: {
    metadata: BespokeMetadata
    fallbackTitle?: string
    headingLevel?: "h2" | "h3"
    className?: string
}): React.ReactElement | null {
    const Heading = headingLevel
    const title = metadata.title ?? fallbackTitle

    if (!title && !metadata.descriptionShort) return null

    return (
        <div className={cx("bespoke-metadata-heading", className)}>
            {title && (
                <Heading className="bespoke-metadata-heading__title">
                    {title}
                    {metadata.title && metadata.titleVariant && (
                        <span className="bespoke-metadata-heading__title-variant">
                            {metadata.titleVariant}
                        </span>
                    )}
                </Heading>
            )}
            {metadata.descriptionShort && (
                <div className="bespoke-metadata-heading__description">
                    <SimpleMarkdownText text={metadata.descriptionShort} />
                </div>
            )}
        </div>
    )
}
