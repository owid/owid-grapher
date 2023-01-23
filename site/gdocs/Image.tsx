import React from "react"
import { EnrichedBlockImage } from "@ourworldindata/utils"
import { LIGHTBOX_IMAGE_CLASS } from "../Lightbox.js"
import cx from "classnames"
import {
    ENV,
    IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH,
    IMAGE_HOSTING_CDN_URL,
} from "../../settings/clientSettings.js"

export default function Image({
    d,
    className = "",
}: {
    d: EnrichedBlockImage
    className?: string
}) {
    const src =
        ENV === "production"
            ? `images/${d.filename}`
            : `${IMAGE_HOSTING_CDN_URL}/${IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH}/${d.filename}`

    return (
        <img
            src={src}
            alt={d.alt}
            className={cx(LIGHTBOX_IMAGE_CLASS, className)}
        />
    )
}
