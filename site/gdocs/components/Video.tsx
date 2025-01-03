import cx from "classnames"
import { LARGEST_IMAGE_WIDTH, Span } from "@ourworldindata/utils"
import { useImage } from "../utils.js"
import SpanElements from "./SpanElements.js"
import { CLOUDFLARE_IMAGES_URL } from "../../../settings/clientSettings.js"

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
    const poster = useImage(filename)
    const posterSrc = poster?.cloudflareId
        ? `${CLOUDFLARE_IMAGES_URL}/${poster.cloudflareId}/w=${LARGEST_IMAGE_WIDTH}`
        : undefined
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
            {caption ? (
                <figcaption>
                    <SpanElements spans={caption} />
                </figcaption>
            ) : null}
        </figure>
    )
}
