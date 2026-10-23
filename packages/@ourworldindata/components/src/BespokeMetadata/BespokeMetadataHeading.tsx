import { BespokeMetadata } from "@ourworldindata/types"
import cx from "clsx"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"

export const BESPOKE_METADATA_TITLE = "About this data"

/** A bespoke viz's metadata heading and the short description under it */
export function BespokeMetadataHeading({
    metadata,
    title,
    headingLevel = "h2",
    className,
}: {
    metadata: BespokeMetadata
    title?: string
    headingLevel?: "h2" | "h3"
    className?: string
}): React.ReactElement | null {
    const Heading = headingLevel

    if (!title && !metadata.descriptionShort) return null

    return (
        <div className={cx("bespoke-metadata-heading", className)}>
            {title && (
                <Heading className="bespoke-metadata-heading__title">
                    {title}
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
