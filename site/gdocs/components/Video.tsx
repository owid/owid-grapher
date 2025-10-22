import { useContext } from "react"
import cx from "classnames"
import {
    LARGEST_IMAGE_WIDTH,
    Span,
    readFromAssetMap,
} from "@ourworldindata/utils"
import { useImage } from "../utils.js"
import SpanElements from "./SpanElements.js"
import { CLOUDFLARE_IMAGES_URL } from "../../../settings/clientSettings.js"
import { DocumentContext } from "../DocumentContext.js"

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
    const { archiveContext } = useContext(DocumentContext)
    const isOnArchivalPage = archiveContext?.type === "archive-page"
    const assetMap = isOnArchivalPage
        ? archiveContext?.assets?.runtime
        : undefined

    const poster = useImage(filename)
    const posterSrc = poster?.cloudflareId
        ? readFromAssetMap(assetMap, {
              path: poster.filename,
              fallback: `${CLOUDFLARE_IMAGES_URL}/${poster.cloudflareId}/w=${LARGEST_IMAGE_WIDTH}`,
          })
        : undefined

    const videoSrc = readFromAssetMap(assetMap, {
        path: url,
        fallback: url,
    })

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
                <source src={videoSrc} type="video/mp4" />
            </video>
            {caption ? (
                <figcaption>
                    <SpanElements spans={caption} />
                </figcaption>
            ) : null}
        </figure>
    )
}
