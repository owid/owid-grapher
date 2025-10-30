/*
Common utlities for deriving properties from image metadata.
*/

import { traverseEnrichedBlock } from "./Util.js"
import { OwidGdoc, OwidGdocType, ImageMetadata } from "@ourworldindata/types"
import { match, P } from "ts-pattern"

export const AUTHOR_BYLINE_WIDTH = 48
export const THUMBNAIL_WIDTH = 100
export const LARGE_THUMBNAIL_WIDTH = 350
export const LARGEST_IMAGE_WIDTH = 1350

export function getSizes(
    originalWidth: ImageMetadata["originalWidth"]
): number[] {
    if (!originalWidth) return []
    // ensure a thumbnail and author byline is generated
    const widths = [AUTHOR_BYLINE_WIDTH, THUMBNAIL_WIDTH]
    // start at large thumbnail and go up by 500 to a max of 1350 before we just show the original image
    let width = LARGE_THUMBNAIL_WIDTH
    while (width < originalWidth && width <= LARGEST_IMAGE_WIDTH) {
        widths.push(width)
        width += 500
    }
    widths.push(originalWidth)
    return widths
}

export function generateSrcSet(
    sizes: number[],
    id: ImageMetadata["cloudflareId"],
    absoluteUrl: string = ""
): string {
    return sizes
        .map((size) => {
            const path = `${absoluteUrl}/${id}/w=${size}`
            return `${path} ${size}w`
        })
        .join(", ")
}

export function getFilenameWithoutExtension(
    filename: ImageMetadata["filename"]
): string {
    return filename.slice(0, filename.indexOf("."))
}

export function getFilenameExtension(
    filename: ImageMetadata["filename"]
): string {
    return filename.slice(filename.lastIndexOf(".") + 1)
}

export function getFilenameAsPng(filename: ImageMetadata["filename"]): string {
    return `${getFilenameWithoutExtension(filename)}.png`
}

export function getFilenameMIMEType(filename: string): string | undefined {
    const fileExtension = getFilenameExtension(filename)
    const MIMEType = {
        png: "image/png",
        svg: "image/svg+xml",
        jpg: "image/jpg",
        jpeg: "image/jpeg",
        webp: "image/webp",
    }[fileExtension]

    return MIMEType
}

export type SourceProps = {
    media: string | undefined
    srcSet: string
}

/**
 * When we have a small and large image, we want to generate two <source> elements.
 * The first will only be active at small screen sizes, due to its `media` property.
 * The second will be active at all screen sizes.
 * These props work in conjuction with a `sizes` attribute on the <source> element.
 */
export function generateSourceProps(
    smallImage: ImageMetadata | undefined,
    regularImage: ImageMetadata,
    absoluteUrl: string = ""
): SourceProps[] {
    const props: SourceProps[] = []
    if (smallImage && smallImage.cloudflareId) {
        const encodedSmallId = encodeURIComponent(smallImage.cloudflareId)
        const smallSizes = getSizes(smallImage.originalWidth)
        props.push({
            media: "(max-width: 768px)",
            srcSet: generateSrcSet(smallSizes, encodedSmallId, absoluteUrl),
        })
    }
    if (regularImage && regularImage.cloudflareId) {
        const encodedRegularId = encodeURIComponent(regularImage.cloudflareId)
        const regularSizes = getSizes(regularImage.originalWidth)
        props.push({
            media: undefined,
            srcSet: generateSrcSet(regularSizes, encodedRegularId, absoluteUrl),
        })
    }
    return props
}

export function getFeaturedImageFilename(gdoc: OwidGdoc): string | undefined {
    return match(gdoc)
        .with(
            {
                content: {
                    type: P.union(
                        OwidGdocType.Article,
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage,
                        OwidGdocType.AboutPage,
                        OwidGdocType.Author,
                        OwidGdocType.Announcement
                    ),
                },
            },
            (match) => {
                const featuredImageFilename = match.content["featured-image"]
                return featuredImageFilename
            }
        )
        .with({ content: { type: OwidGdocType.DataInsight } }, (gdoc) => {
            // Use the first image in the document as the featured image
            let filename: string | undefined = undefined
            for (const block of gdoc.content.body) {
                traverseEnrichedBlock(block, (block) => {
                    if (!filename && block.type === "image") {
                        filename = block.smallFilename || block.filename
                    }
                })
            }
            return filename
        })
        .with(
            {
                content: { type: OwidGdocType.Profile },
            },
            (match) => match.content["featured-image"]
        )
        .with(
            {
                content: {
                    type: P.optional(
                        P.union(OwidGdocType.Fragment, OwidGdocType.Homepage)
                    ),
                },
            },
            // This will fallback to DEFAULT_THUMBNAIL_FILENAME in Head.tsx
            () => undefined
        )
        .exhaustive()
}
