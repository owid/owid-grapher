import React, { useContext } from "react"
import {
    getFilenameWithoutExtension,
    IMAGES_DIRECTORY,
    generateSourceProps,
    ImageMetadata,
    getFilenameMIMEType,
} from "@ourworldindata/utils"
import cx from "classnames"
import { LIGHTBOX_IMAGE_CLASS } from "../../Lightbox.js"
import {
    IMAGE_HOSTING_R2_BUCKET_SUBFOLDER_PATH,
    IMAGE_HOSTING_R2_CDN_URL,
} from "../../../settings/clientSettings.js"
import { DocumentContext } from "../OwidGdoc.js"
import { Container } from "./ArticleBlock.js"
import { useImage } from "../utils.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"

// generates rules that tell the browser:
// below the medium breakpoint, the image will be 95vw wide
// above that breakpoint, the image will be (at maximum) some fraction of 1280px
const generateResponsiveSizes = (numberOfColumns: number): string =>
    `(max-width: 960px) 95vw, (min-width: 960px) ${Math.floor(
        1280 * (numberOfColumns / 12)
    )}px`

const gridSpan2 = generateResponsiveSizes(2)
const gridSpan5 = generateResponsiveSizes(5)
const gridSpan6 = generateResponsiveSizes(6)
const gridSpan7 = generateResponsiveSizes(7)
const gridSpan8 = generateResponsiveSizes(8)

export type ImageParentContainer =
    | Exclude<Container, "sticky-right-left-heading-column">
    | "thumbnail"
    | "full-width"
    | "span-5"
    | "span-6"
    | "span-7"
    | "span-8"

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
    ["author-header"]: gridSpan2,
    ["span-5"]: gridSpan5,
    ["span-6"]: gridSpan6,
    ["span-7"]: gridSpan7,
    ["span-8"]: gridSpan8,
}

export default function Image(props: {
    filename: string
    smallFilename?: string
    alt?: string
    hasOutline?: boolean
    className?: string
    containerType?: ImageParentContainer
    shouldLightbox?: boolean
}) {
    const {
        filename,
        smallFilename,
        hasOutline,
        containerType = "default",
        shouldLightbox = true,
    } = props

    const className = cx(props.className, {
        "image--has-outline": hasOutline,
    })

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
            `${IMAGE_HOSTING_R2_CDN_URL}/${IMAGE_HOSTING_R2_BUCKET_SUBFOLDER_PATH}/${encodeURIComponent(
                f
            )}`

        const PreviewSource = (props: { i?: ImageMetadata; sm?: boolean }) => {
            const { i, sm } = props
            if (!i) return null

            return (
                <source
                    srcSet={`${makePreviewUrl(i.filename)} ${i.originalWidth}w`}
                    media={sm ? "(max-width: 768px)" : undefined}
                    type={getFilenameMIMEType(i.filename)}
                    sizes={
                        containerSizes[containerType] ?? containerSizes.default
                    }
                />
            )
        }
        return (
            <picture className={className}>
                <PreviewSource i={smallImage} sm />
                <PreviewSource i={image} />
                <img
                    src={makePreviewUrl(image.filename)}
                    alt={alt}
                    className={maybeLightboxClassName}
                    width={image.originalWidth ?? undefined}
                    height={image.originalHeight ?? undefined}
                />
            </picture>
        )
    }

    if (filename.endsWith(".svg")) {
        const pngFilename = `${getFilenameWithoutExtension(filename)}.png`
        const imgSrc = `${IMAGES_DIRECTORY}${encodeURIComponent(filename)}`
        return (
            <div className={className}>
                <img
                    src={imgSrc}
                    alt={alt}
                    className={maybeLightboxClassName}
                    width={image.originalWidth ?? undefined}
                    height={image.originalHeight ?? undefined}
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

    const imageSrc = `${IMAGES_DIRECTORY}${encodeURIComponent(filename)}`
    const sourceProps = generateSourceProps(smallImage, image)

    return (
        <picture className={className}>
            {sourceProps.map((props, i) => (
                <source
                    key={i}
                    {...props}
                    type="image/png"
                    sizes={
                        containerSizes[containerType] ?? containerSizes.default
                    }
                />
            ))}
            <img
                src={imageSrc}
                alt={alt}
                className={maybeLightboxClassName}
                loading="lazy"
                // There's no way of knowing in advance whether we'll be showing the image or smallImage - we just have to choose one
                // I went with image, as we currently only use smallImage for data insights
                width={image.originalWidth ?? undefined}
                height={image.originalHeight ?? undefined}
            />
        </picture>
    )
}
