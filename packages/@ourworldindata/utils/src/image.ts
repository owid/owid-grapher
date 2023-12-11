/*
Common utlities for deriving properties from image metadata.
*/

// This is the JSON we get from Google's API before remapping the keys to be consistent with the rest of our interfaces
export interface GDriveImageMetadata {
    name: string // -> filename
    modifiedTime: string // -> updatedAt e.g. "2023-01-11T19:45:27.000Z"
    id: string // -> googleId e.g. "1dfArzg3JrAJupVl4YyJpb2FOnBn4irPX"
    description?: string // -> defaultAlt
    imageMediaMetadata?: {
        width?: number // -> originalWidth
    }
}

export interface ImageMetadata {
    googleId: string
    filename: string
    defaultAlt: string
    // MySQL Date objects round to the nearest second, whereas Google includes milliseconds
    // so we store as an epoch to avoid any conversion issues
    updatedAt: number
    originalWidth?: number
}

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
