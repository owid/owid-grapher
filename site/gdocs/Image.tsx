import React, { useContext } from "react"
import {
    EnrichedBlockImage,
    getSizes,
    generateSrcSet,
    getFilenameWithoutExtension,
} from "@ourworldindata/utils"
import { LIGHTBOX_IMAGE_CLASS } from "../Lightbox.js"
import cx from "classnames"
import {
    IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH,
    IMAGE_HOSTING_CDN_URL,
} from "../../settings/clientSettings.js"
import { ArticleContext } from "./OwidArticle.js"

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
                className={cx(LIGHTBOX_IMAGE_CLASS, className, "lazyload")}
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
            className={cx(LIGHTBOX_IMAGE_CLASS, className, "lazyload")}
        />
    )
}
