import React, { useContext } from "react"
import cx from "classnames"
import { IMAGES_DIRECTORY, Span } from "@ourworldindata/utils"
import { renderSpans } from "../utils.js"
import { DocumentContext } from "../OwidGdoc.js"
import {
    IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH,
    IMAGE_HOSTING_CDN_URL,
} from "../../../settings/clientSettings.js"

interface VideoProps {
    url: string
    caption?: Span[]
    className?: string
    shouldLoop?: boolean
    shouldAutoplay?: boolean
    filename: string
}

export default function Video(props: VideoProps) {
    const { url, caption, className, shouldLoop, shouldAutoplay, filename } =
        props
    const { isPreviewing } = useContext(DocumentContext)
    const posterSrc = isPreviewing
        ? `${IMAGE_HOSTING_CDN_URL}/${IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH}/${filename}`
        : `${IMAGES_DIRECTORY}${filename}`
    return (
        <figure className={cx(className)}>
            <video
                muted
                controls
                autoPlay={shouldAutoplay}
                preload={shouldAutoplay ? "auto" : "none"}
                loop={shouldLoop}
                poster={posterSrc}
            >
                <source src={url} type="video/mp4" />
            </video>
            {caption ? <figcaption>{renderSpans(caption)}</figcaption> : null}
        </figure>
    )
}
