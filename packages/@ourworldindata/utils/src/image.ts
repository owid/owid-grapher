/*
Common utlities for deriving properties from image metadata.
*/

import { traverseEnrichedBlocks } from "./Util.js"
import {
    OwidGdoc,
    OwidGdocType,
    IMAGES_DIRECTORY,
    ImageMetadata,
} from "@ourworldindata/types"
import { match, P } from "ts-pattern"

export function getSizes(
    originalWidth: ImageMetadata["originalWidth"]
): number[] {
    if (!originalWidth) return []
    // ensure a thumbnail is generated
    const widths = [100]
    // start at 350 and go up by 500 to a max of 1350 before we just show the original image
    let width = 350
    while (width < originalWidth && width <= 1350) {
        widths.push(width)
        width += 500
    }
    widths.push(originalWidth)
    return widths
}

export function generateSrcSet(
    sizes: number[],
    filename: ImageMetadata["filename"]
): string {
    return sizes
        .map((size) => {
            const path = `/images/published/${getFilenameWithoutExtension(
                filename
            )}_${size}.webp`
            return `${encodeURI(path)} ${size}w`
        })
        .join(", ")
}

export function getFilenameWithoutExtension(
    filename: ImageMetadata["filename"]
): string {
    return filename.slice(0, filename.indexOf("."))
}

export function getFilenameAsPng(filename: ImageMetadata["filename"]): string {
    return `${getFilenameWithoutExtension(filename)}.png`
}

/**
 * example-image.png -> https://ourworldindata.org/uploads/published/example-image.png
 */
export const filenameToUrl = (filename: string, baseUrl: string): string =>
    new URL(`${IMAGES_DIRECTORY}${getFilenameAsPng(filename)}`, baseUrl).href

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
    regularImage: ImageMetadata
): SourceProps[] {
    const props: SourceProps[] = []
    if (smallImage) {
        const smallSizes = getSizes(smallImage.originalWidth)
        props.push({
            media: "(max-width: 768px)",
            srcSet: generateSrcSet(smallSizes, smallImage.filename),
        })
    }
    const regularSizes = getSizes(regularImage.originalWidth)
    props.push({
        media: undefined,
        srcSet: generateSrcSet(regularSizes, regularImage.filename),
    })
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
                        OwidGdocType.LinearTopicPage
                    ),
                },
            },
            (match) => {
                const featuredImageSlug = match.content["featured-image"]
                // Social media platforms don't support SVG's for og:image
                // So no matter what, we use the png fallback that the baker generates
                return featuredImageSlug
                    ? getFilenameAsPng(featuredImageSlug)
                    : undefined
            }
        )
        .with({ content: { type: OwidGdocType.DataInsight } }, (gdoc) => {
            // Use the first image in the document as the featured image
            let filename: string | undefined = undefined
            for (const block of gdoc.content.body) {
                traverseEnrichedBlocks(block, (block) => {
                    if (!filename && block.type === "image") {
                        filename = block.smallFilename || block.filename
                    }
                })
            }
            return filename
        })
        .with(
            { content: { type: P.union(OwidGdocType.Fragment, undefined) } },
            () => {
                return undefined
            }
        )
        .exhaustive()
}
