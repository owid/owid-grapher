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
}: {
    previewUrl: string
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
                width={GRAPHER_THUMBNAIL_WIDTH}
                height={GRAPHER_THUMBNAIL_HEIGHT}
                src={previewUrl}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
            />
        </div>
    )
}
