import React, { useContext } from "react"
import {
    EnrichedBlockImage,
    getSizes,
    generateSrcSet,
} from "@ourworldindata/utils"
import { LIGHTBOX_IMAGE_CLASS } from "../Lightbox.js"
import cx from "classnames"
import {
    IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH,
    IMAGE_HOSTING_CDN_URL,
} from "../../settings/clientSettings.js"
import { ArticleContext } from "./OwidArticle.js"
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

type ImageParentContainer = Container | "thumbnail"

const containerSizes: Record<ImageParentContainer, string> = {
    ["default"]: gridSpan6,
    ["sticky-right-left-column"]: gridSpan5,
    ["sticky-right-right-column"]: gridSpan7,
    ["sticky-left-left-column"]: gridSpan7,
    ["sticky-left-right-column"]: gridSpan5,
    ["side-by-side"]: gridSpan6,
    ["summary"]: gridSpan6,
    ["thumbnail"]: "350px",
}

export default function Image(props: {
    filename: string
    alt?: string
    className?: string
    containerType?: ImageParentContainer
}) {
    const { filename, className = "", containerType = "default" } = props
    const { isPreviewing } = useContext(ArticleContext)
    const image = useImage(filename)
    if (!image) {
        if (isPreviewing) {
            return (
                <BlockErrorFallback
                    className={className}
                    error={{
                        name: "Image error",
                        message: `Image with filename "${filename}" not found. This block will not render when the page is baked.`,
                    }}
                />
            )
        }
        return null
    }

    const alt = props.alt ?? image.defaultAlt

    if (isPreviewing) {
        return (
            <img
                src={`${IMAGE_HOSTING_CDN_URL}/${IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH}/${filename}`}
                alt={alt}
                className={cx(LIGHTBOX_IMAGE_CLASS, className, "lazyload")}
            />
        )
    }

    if (filename.endsWith(".svg")) {
        return (
            <img
                src={`/images/published/${filename}`}
                alt={alt}
                className={cx(LIGHTBOX_IMAGE_CLASS, className)}
            />
        )
    }

    const sizes = getSizes(image.originalWidth)
    const srcSet = generateSrcSet(sizes, filename)

    return (
        <picture className={className}>
            <source
                srcSet={srcSet}
                type="image/webp"
                sizes={containerSizes[containerType] ?? containerSizes.default}
            />
            <img
                src={`/images/published/${filename}`}
                alt={alt}
                className={LIGHTBOX_IMAGE_CLASS}
            />
        </picture>
    )
}
