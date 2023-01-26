import React, { useContext } from "react"
import { EnrichedBlockImage } from "@ourworldindata/utils"
import { LIGHTBOX_IMAGE_CLASS } from "../Lightbox.js"
import cx from "classnames"
import {
    IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH,
    IMAGE_HOSTING_CDN_URL,
} from "../../settings/clientSettings.js"
import { ArticleContext } from "./OwidArticle.js"

// temporarily duplicated code from Image.ts
function getSizes(originalWidth?: number): number[] | undefined {
    // ensure a thumbnail is generated thumbnail
    const widths = [100]
    // start at 350 and go up by 500 to a max of 1350 before we just show the original image
    let width = 350
    while (width < originalWidth! && width <= 1350) {
        widths.push(width)
        width += 500
    }
    widths.push(originalWidth!)
    return widths
}

const generateSrcSet = (sizes: number[], filename: string): string =>
    sizes
        ?.map(
            (size) =>
                `images/${filename.slice(
                    0,
                    filename.indexOf(".")
                )}_${size}.webp ${size}w`
        )
        .join(", ")

export default function Image({
    d,
    className = "",
}: {
    d: EnrichedBlockImage
    className?: string
}) {
    const articleContext = useContext(ArticleContext)
    if (articleContext.isPreviewing) {
        return (
            <img
                src={`${IMAGE_HOSTING_CDN_URL}/${IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH}/${d.filename}`}
                alt={d.alt}
                className={cx(LIGHTBOX_IMAGE_CLASS, className)}
            />
        )
    }

    if (d.filename.endsWith(".svg")) {
        return (
            <img
                src={`images/${d.filename}`}
                alt={d.alt}
                className={cx(LIGHTBOX_IMAGE_CLASS, className)}
            />
        )
    }

    const sizes = getSizes(d.originalWidth)
    const srcSet = generateSrcSet(sizes!, d.filename)

    return (
        <img
            srcSet={srcSet}
            alt={d.alt}
            data-sizes="auto"
            className={cx(LIGHTBOX_IMAGE_CLASS, className, "lazyload")}
        />
    )
}
