import { BespokeMetadata } from "@ourworldindata/types"
import cx from "clsx"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"

export const BESPOKE_METADATA_TITLE = "About this data"

/** A bespoke viz's metadata title and the short description under it */
export function BespokeMetadataHeading({
    metadata,
    headingLevel = "h2",
    className,
}: {
    metadata: BespokeMetadata
    headingLevel?: "h2" | "h3"
    className?: string
}): React.ReactElement | null {
    const Heading = headingLevel

    if (!metadata.title) return null

    return (
        <div className={cx("bespoke-metadata-heading", className)}>
            <Heading className="bespoke-metadata-heading__title">
                {metadata.title}
            </Heading>
            {metadata.descriptionShort && (
                <div className="bespoke-metadata-heading__description">
                    <SimpleMarkdownText text={metadata.descriptionShort} />
                </div>
            )}
        </div>
    )
}
