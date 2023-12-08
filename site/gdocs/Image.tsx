import React, { useContext } from "react"
import {
    getSizes,
    generateSrcSet,
    getFilenameWithoutExtension,
    IMAGES_DIRECTORY,
    identity,
    ImageMetadata,
} from "@ourworldindata/utils"
import { LIGHTBOX_IMAGE_CLASS } from "../Lightbox.js"
import {
    IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH,
    IMAGE_HOSTING_CDN_URL,
} from "../../settings/clientSettings.js"
import { DocumentContext } from "./OwidGdoc.js"
import { Container } from "./ArticleBlock.js"
import { useImage } from "./utils.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"

// generates rules that tell the browser:
// below the medium breakpoint, the image will be 95vw wide
// above that breakpoint, the image will be (at maximum) some fraction of 1280px
const generateResponsiveSizes = (numberOfColumns: number): string =>
    `(max-width: 960px) 95vw, (min-width: 960px) ${Math.floor(
        1280 * (numberOfColumns / 12)
    )}px`

const gridSpan5 = generateResponsiveSizes(5)
const gridSpan6 = generateResponsiveSizes(6)
const gridSpan7 = generateResponsiveSizes(7)
const gridSpan8 = generateResponsiveSizes(8)

type ImageParentContainer = Container | "thumbnail" | "full-width"

const containerSizes: Record<ImageParentContainer, string> = {
    ["default"]: gridSpan8,
    ["sticky-right-left-column"]: gridSpan5,
    ["sticky-right-right-column"]: gridSpan7,
    ["sticky-left-left-column"]: gridSpan7,
    ["sticky-left-right-column"]: gridSpan5,
    ["side-by-side"]: gridSpan6,
    ["summary"]: gridSpan6,
    ["thumbnail"]: "350px",
    ["datapage"]: gridSpan6,
    ["full-width"]: "100vw",
    ["key-insight"]: gridSpan5,
}

export default function Image(props: {
    filename: string
    smallFilename?: string
    alt?: string
    className?: string
    containerType?: ImageParentContainer
    shouldLightbox?: boolean
}) {
    const {
        filename,
        smallFilename,
        className = "",
        containerType = "default",
        shouldLightbox = true,
    } = props
    const { isPreviewing } = useContext(DocumentContext)
    const image = useImage(filename)
    const smallImage = useImage(smallFilename)
    const renderImageError = (name: string) => (
        <BlockErrorFallback
            className={className}
            error={{
                name: "Image error",
                message: `Image with filename "${name}" not found. This block will not render when the page is baked.`,
            }}
        />
    )

    if (!image) {
        if (isPreviewing) {
            return renderImageError(filename)
        }
        // Don't render anything if we're not previewing (i.e. a bake) and the image is not found
        return null
    }
    // Here we can fall back to the regular image filename, so don't return null if not found
    if (isPreviewing && smallFilename && !smallImage) {
        return renderImageError(smallFilename)
    }

    const alt = props.alt ?? image.defaultAlt
    const maybeLightboxClassName =
        containerType === "thumbnail" || !shouldLightbox
            ? ""
            : LIGHTBOX_IMAGE_CLASS

    if (isPreviewing) {
        const makePreviewUrl = (f: string) =>
            `${IMAGE_HOSTING_CDN_URL}/${IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH}/${f}`

        const previewSrcset = [smallImage, image]
            .filter((i): i is ImageMetadata => !!i)
            .map((i) => `${makePreviewUrl(i.filename)} ${i.originalWidth}w`)
            .join(", ")

        return (
            <picture className={className}>
                <source
                    srcSet={previewSrcset}
                    type="image/webp"
                    sizes={
                        containerSizes[containerType] ?? containerSizes.default
                    }
                />
                <img
                    src={makePreviewUrl(image.filename)}
                    alt={alt}
                    className={maybeLightboxClassName}
                />
            </picture>
        )
    }

    if (filename.endsWith(".svg")) {
        const pngFilename = `${getFilenameWithoutExtension(filename)}.png`
        const imgSrc = `${IMAGES_DIRECTORY}${filename}`
        return (
            <div className={className}>
                <img
                    src={encodeURI(imgSrc)}
                    alt={alt}
                    className={maybeLightboxClassName}
                />
                {containerType !== "thumbnail" ? (
                    <a
                        className="download-png-link"
                        href={`${IMAGES_DIRECTORY}${pngFilename}`}
                        download
                    >
                        Download image
                    </a>
                ) : null}
            </div>
        )
    }

    let sizes = getSizes(image.originalWidth)
    let smallSrcSet = ""
    if (smallImage) {
        /**
         * If we have a small image
         * 1. generate its srcSet
         * 2. remove sizes that are smaller than it from the sizes of the larger image
         * 3. generate the srcSet for the larger image
         * 4. combine the two srcSets
         * e.g. small_100.png 100px, small_350.png 350px, large_600.png 600px, large_850.png 850px
         */
        const smallSizes = getSizes(smallImage.originalWidth)
        smallSrcSet = generateSrcSet(smallSizes, smallImage.filename)
        sizes = sizes.filter((size) => size > smallImage.originalWidth!)
    }
    const srcSet = generateSrcSet(sizes, filename)
    const imageSrc = `${IMAGES_DIRECTORY}${filename}`
    const finalSrcSet = [smallSrcSet, srcSet].filter(identity).join(", ")

    return (
        <picture className={className}>
            <source
                srcSet={finalSrcSet}
                type="image/webp"
                sizes={containerSizes[containerType] ?? containerSizes.default}
            />
            <img
                src={encodeURI(imageSrc)}
                alt={alt}
                className={maybeLightboxClassName}
                loading="lazy"
            />
        </picture>
    )
}
