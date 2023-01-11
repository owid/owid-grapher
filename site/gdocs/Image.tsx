import React from "react"
import { EnrichedBlockImage } from "@ourworldindata/utils"
import { LIGHTBOX_IMAGE_CLASS } from "../Lightbox.js"
import cx from "classnames"

export default function Image({
    d,
    className = "",
}: {
    d: EnrichedBlockImage
    className?: string
}) {
    return (
        <img
            src=""
            alt={d.alt}
            className={cx(LIGHTBOX_IMAGE_CLASS, className)}
        />
    )
}
