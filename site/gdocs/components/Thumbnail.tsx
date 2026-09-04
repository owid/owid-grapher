import {
    ARCHIVED_THUMBNAIL_FILENAME,
    DEFAULT_THUMBNAIL_FILENAME,
} from "@ourworldindata/types"
import {
    EXPLORER_DYNAMIC_THUMBNAIL_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../../../settings/clientSettings"
import Image, { ImageParentContainer } from "./Image"

export const Thumbnail = ({
    thumbnail,
    className,
    // Only affects which srcset candidate the browser picks. Override it when
    // the thumbnail is rendered much smaller than the usual ~350px slot.
    containerType = "thumbnail",
}: {
    thumbnail?: string
    className?: string
    containerType?: ImageParentContainer
}) => {
    if (!thumbnail)
        return (
            <img
                src={`/${DEFAULT_THUMBNAIL_FILENAME}`}
                className={className}
                loading="lazy"
            />
        )
    if (
        (GRAPHER_DYNAMIC_THUMBNAIL_URL &&
            thumbnail.startsWith(GRAPHER_DYNAMIC_THUMBNAIL_URL)) ||
        (EXPLORER_DYNAMIC_THUMBNAIL_URL &&
            thumbnail.startsWith(EXPLORER_DYNAMIC_THUMBNAIL_URL)) ||
        thumbnail.endsWith(ARCHIVED_THUMBNAIL_FILENAME) ||
        thumbnail.endsWith(DEFAULT_THUMBNAIL_FILENAME)
    ) {
        return <img src={thumbnail} className={className} loading="lazy" />
    } else {
        return (
            <Image
                filename={thumbnail}
                containerType={containerType}
                className={className}
                // Thumbnails are never interactive. `Image` already infers this
                // from the "thumbnail" container type; saying it explicitly
                // keeps it true for the other container types too.
                shouldLightbox={false}
            />
        )
    }
}
