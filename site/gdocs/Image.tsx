import React, { useContext } from "react"
import { EnrichedBlockImage } from "@ourworldindata/utils"
import { LIGHTBOX_IMAGE_CLASS } from "../Lightbox.js"
import cx from "classnames"
import {
    IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH,
    IMAGE_HOSTING_CDN_URL,
} from "../../settings/clientSettings.js"
import { ArticleContext } from "./OwidArticle.js"

// temporarily duplicated code from Image.ts, should probably remove from the Image class and create functions in utils to share
function getSizes(originalWidth: number): number[] | undefined {
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

function generateSrcSet(sizes: number[], filename: string): string {
    return sizes
        ?.map(
            (size) =>
                `images/${filename.slice(
                    0,
                    filename.indexOf(".")
                )}_${size}.webp ${size}w`
        )
        .join(", ")
}

function getFilenameWithoutExtension(filename: string) {
    return filename.slice(0, filename.indexOf("."))
}

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
                loading="lazy"
                className={cx(LIGHTBOX_IMAGE_CLASS, className, "lazyload")}
            />
        )
    }

    if (d.filename.endsWith(".svg")) {
        return (
            <img
                src={`images/${d.filename}`}
                alt={d.alt}
                loading="lazy"
                className={cx(LIGHTBOX_IMAGE_CLASS, className)}
            />
        )
    }

    const sizes = getSizes(d.originalWidth!) as number[]
    const srcSet = generateSrcSet(sizes!, d.filename)
    const src = `images/${getFilenameWithoutExtension(
        d.filename
    )}_${d.originalWidth!}.webp`

    return (
        <img
            srcSet={srcSet}
            src={src}
            alt={d.alt}
            data-sizes="auto"
            loading="lazy"
            className={cx(LIGHTBOX_IMAGE_CLASS, className, "lazyload")}
        />
    )
}
