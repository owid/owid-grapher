import { useState } from "react"
import {
    EXPLORER_DYNAMIC_THUMBNAIL_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../../../settings/clientSettings.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faHeartBroken } from "@fortawesome/free-solid-svg-icons"

interface ChartPreviewProps {
    chartSlug: string
    queryString?: string
    chartType?: "chart" | "explorer"
}

export function ChartPreview({
    chartSlug,
    queryString = "",
    chartType,
}: ChartPreviewProps) {
    const [imgLoaded, setImgLoaded] = useState(false)
    const [imgError, setImgError] = useState(false)
    const baseUrl =
        chartType === "explorer"
            ? EXPLORER_DYNAMIC_THUMBNAIL_URL
            : GRAPHER_DYNAMIC_THUMBNAIL_URL

    const thumbnailUrl = `${baseUrl}/${chartSlug}.png${queryString}`

    return (
        <div className="chart-preview">
            {imgError ? (
                <div className="chart-preview-error">
                    <FontAwesomeIcon icon={faHeartBroken} />
                    Preview unavailable
                </div>
            ) : (
                <img
                    src={thumbnailUrl}
                    alt="Chart preview"
                    style={{
                        display: imgLoaded ? "block" : "none",
                    }}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                />
            )}
            {!imgLoaded && !imgError && (
                <div className="chart-preview-loading">
                    Loading preview&hellip;
                </div>
            )}
        </div>
    )
}
