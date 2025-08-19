import { faHeartBroken } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useState } from "react"
import cx from "classnames"
import {
    GRAPHER_THUMBNAIL_HEIGHT,
    GRAPHER_THUMBNAIL_WIDTH,
} from "@ourworldindata/grapher"

export const SearchChartHitThumbnail = ({
    previewUrl,
    imageWidth = GRAPHER_THUMBNAIL_WIDTH,
    imageHeight = GRAPHER_THUMBNAIL_HEIGHT,
}: {
    previewUrl: string
    imageWidth?: number
    imageHeight?: number
}) => {
    const [imgLoaded, setImgLoaded] = useState(false)
    const [imgError, setImgError] = useState(false)

    return (
        <div className="search-chart-hit-thumbnail">
            {imgError && (
                <div className="chart-hit-img-error">
                    <FontAwesomeIcon icon={faHeartBroken} />
                    <span>Chart preview not available</span>
                </div>
            )}
            <img
                key={previewUrl}
                className={cx({ loaded: imgLoaded, error: imgError })}
                loading="lazy"
                width={imageWidth}
                height={imageHeight}
                src={previewUrl}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
            />
        </div>
    )
}
