import React, { useCallback, useContext } from "react"
import {
    generateSourceProps,
    ImageMetadata,
    triggerDownloadFromBlob,
} from "@ourworldindata/utils"
import cx from "classnames"
import { LIGHTBOX_IMAGE_CLASS } from "../../Lightbox.js"
import { CLOUDFLARE_IMAGES_URL } from "../../../settings/clientSettings.js"
import { DocumentContext } from "../OwidGdoc.js"
import { Container } from "./ArticleBlock.js"
import { useImage } from "../utils.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../../SiteConstants.js"
import { useMediaQuery } from "usehooks-ts"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons"

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
    | "author-byline"
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
    ["author-byline"]: "48px",
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
        image: true,
        "image--has-outline": hasOutline,
    })

    const isPreviewing = useContext(DocumentContext).isPreviewing
    const isSmall = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
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

    const handleDownload = useCallback(async () => {
        let src = ""
        let filename = ""
        if (image) {
            src = makeSrc(image)
            filename = image.filename
        }
        if (isSmall && smallImage) {
            src = makeSrc(smallImage)
            filename = smallImage.filename
        }
        if (src && filename) {
            const response = await fetch(src)
            const blob = await response.blob()
            triggerDownloadFromBlob(filename, blob)
        }
    }, [image, smallImage, isSmall])

    if (!image || !image.cloudflareId) {
        if (isPreviewing) {
            return renderImageError(filename)
        }
        // Don't render anything if we're not previewing (i.e. a bake) and the image is not found
        return null
    }

    const alt = props.alt ?? image.defaultAlt
    const isInteractive = containerType !== "thumbnail" && shouldLightbox
    const maybeLightboxClassName = isInteractive ? LIGHTBOX_IMAGE_CLASS : ""

    // TODO: SVG?

    function makeSrc(image: ImageMetadata) {
        if (!image.cloudflareId) {
            throw new Error("Image has no cloudflareId")
        }
        return `${CLOUDFLARE_IMAGES_URL}/${encodeURIComponent(image.cloudflareId)}/w=${image.originalWidth}`
    }

    const imageSrc = makeSrc(image)
    const sourceProps = generateSourceProps(
        smallImage,
        image,
        CLOUDFLARE_IMAGES_URL
    )

    return (
        <div className={className}>
            <picture>
                {sourceProps.map((props, i) => (
                    <source
                        key={i}
                        {...props}
                        type="image/png"
                        sizes={
                            containerSizes[containerType] ??
                            containerSizes.default
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
            {isInteractive && (
                <div className="article-block__image-download-button-container">
                    <button
                        aria-label={`Download ${filename}`}
                        className="article-block__image-download-button"
                        onClick={(e) => {
                            e.preventDefault()
                            void handleDownload()
                        }}
                    >
                        <FontAwesomeIcon
                            icon={faDownload}
                            className="article-block__image-download-button-icon"
                        />
                        <span className="article-block__image-download-button-text">
                            Download image
                        </span>
                    </button>
                </div>
            )}
        </div>
    )
}
