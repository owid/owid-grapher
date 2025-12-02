import { useCallback, useContext, useState } from "react"
import {
    AssetMap,
    generateSourceProps,
    ImageMetadata,
    readFromAssetMap,
    triggerDownloadFromBlob,
} from "@ourworldindata/utils"
import cx from "classnames"
import { CLOUDFLARE_IMAGES_URL } from "../../../settings/clientSettings.js"
import { DocumentContext } from "../DocumentContext.js"
import { useImage } from "../utils.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../../SiteConstants.js"
import { useMediaQuery } from "usehooks-ts"
import { Container } from "./layout.js"
import { Lightbox } from "../../Lightbox.js"
import { FloatingDownloadButton } from "./FloatingDownloadButton.js"

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
    | "person"
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
    ["about-page"]: gridSpan8,
    ["author-byline"]: "48px",
    ["author-header"]: gridSpan2,
    ["person"]: gridSpan2,
    ["span-5"]: gridSpan5,
    ["span-6"]: gridSpan6,
    ["span-7"]: gridSpan7,
    ["span-8"]: gridSpan8,
}

export const LIGHTBOX_IMAGE_CLASS = "lightbox-image"

function makeSrc(image: ImageMetadata, assetMap?: AssetMap) {
    if (!image.cloudflareId) {
        throw new Error("Image has no cloudflareId")
    }
    return readFromAssetMap(assetMap, {
        path: image.filename,
        fallback: `${CLOUDFLARE_IMAGES_URL}/${image.cloudflareId}/w=${image.originalWidth}`,
    })
}

export default function Image(props: {
    filename?: string
    smallFilename?: string
    alt?: string
    hasOutline?: boolean
    className?: string
    containerType?: ImageParentContainer
    shouldLightbox?: boolean
    shouldHideDownloadButton?: boolean
    preferSmallFilename?: boolean
    // Manually-passed image data (for StaticViz)
    imageData?: ImageMetadata
    smallImageData?: ImageMetadata
}) {
    const {
        filename,
        smallFilename,
        hasOutline,
        containerType = "default",
        shouldLightbox = true,
        shouldHideDownloadButton = false,
        preferSmallFilename,
        imageData,
        smallImageData,
    } = props

    const className = cx("image", props.className, {
        "image--has-outline": hasOutline,
    })

    // Whether we should show the lightbox and a download button
    const isInteractive = shouldLightbox && containerType !== "thumbnail"

    const { archiveContext, isPreviewing } = useContext(DocumentContext)
    const isOnArchivalPage = archiveContext?.type === "archive-page"
    const assetMap = isOnArchivalPage
        ? archiveContext?.assets?.runtime
        : undefined
    const isSmall = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)

    // Always call hooks unconditionally, then choose which data to use
    const imageFromHook = useImage(filename)
    const smallImageFromHook = useImage(smallFilename)

    // Use manually-passed image data if provided, otherwise use filename-based lookup
    const image = imageData || imageFromHook
    const smallImage = smallImageData || smallImageFromHook
    const activeImage =
        (isSmall || preferSmallFilename) && smallImage ? smallImage : image
    const [isLightboxOpen, setIsLightboxOpen] = useState(false)

    const openLightbox = useCallback(() => {
        if (isInteractive) {
            setIsLightboxOpen(true)
        }
    }, [isInteractive])

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
        if (!activeImage) return
        const { filename } = activeImage
        const src = makeSrc(activeImage, assetMap)
        if (src && filename) {
            const response = await fetch(src)
            const blob = await response.blob()
            triggerDownloadFromBlob(filename, blob)
        }
    }, [activeImage, assetMap])

    if (!activeImage || !activeImage.cloudflareId) {
        if (isPreviewing) {
            return renderImageError(filename || "unknown")
        }
        // Don't render anything if we're not previewing (i.e. a bake) and the image is not found
        return null
    }

    const alt = props.alt ?? activeImage.defaultAlt

    const imageSrc = makeSrc(activeImage, assetMap)
    const sourceProps = generateSourceProps(
        smallImage,
        activeImage,
        CLOUDFLARE_IMAGES_URL,
        assetMap
    )

    return (
        <div className={className}>
            <picture onClick={openLightbox}>
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
                    className={isInteractive ? LIGHTBOX_IMAGE_CLASS : undefined}
                    loading="lazy"
                    // There's no way of knowing in advance whether we'll be showing the image or smallImage - we just have to choose one
                    // I went with image, as we currently only use smallImage for data insights
                    width={activeImage.originalWidth ?? undefined}
                    height={activeImage.originalHeight ?? undefined}
                />
            </picture>
            {isInteractive && !shouldHideDownloadButton && (
                <FloatingDownloadButton
                    label={`Download`}
                    onClick={() => void handleDownload()}
                />
            )}
            {isLightboxOpen && (
                <Lightbox
                    imgSrc={imageSrc}
                    onClose={() => setIsLightboxOpen(false)}
                    imgFilename={activeImage.filename}
                    width={activeImage.originalWidth}
                    height={activeImage.originalHeight}
                    alt={alt}
                />
            )}
        </div>
    )
}
