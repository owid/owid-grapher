import * as React from "react"
import { useCallback, useState } from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload, faSpinner } from "@fortawesome/free-solid-svg-icons"
import { DownloadIconFull } from "../icons/DownloadIconFull.js"
import { DownloadIconSelected } from "../icons/DownloadIconSelected.js"

export function DownloadButton({
    className,
    title,
    description,
    icon,
    previewImageUrl,
    imageStyle,
    trackingNote,
    onClick,
    disabled,
}: {
    className?: string
    title: string
    description: string
    icon?: "full" | "selected"
    previewImageUrl?: string
    imageStyle?: React.CSSProperties
    trackingNote?: string
    onClick: () => void | Promise<void>
    disabled?: boolean
}) {
    const [isDownloading, setIsDownloading] = useState(false)
    const [showLoading, setShowLoading] = useState(false)

    const handleClick = useCallback(async () => {
        setIsDownloading(true)

        // Delay showing the loading UI to prevent flashing for quick downloads.
        const loadingTimeout = setTimeout(() => setShowLoading(true), 300)

        try {
            await onClick()
        } finally {
            clearTimeout(loadingTimeout)
            setIsDownloading(false)
            setShowLoading(false)
        }
    }, [onClick])

    return (
        <button
            className={cx("download-button", className, {
                "download-button--loading": showLoading,
            })}
            onClick={handleClick}
            data-track-note={trackingNote}
            disabled={disabled || isDownloading}
        >
            {icon && (
                <div className="download-button__icon">
                    {icon === "full" ? (
                        <DownloadIconFull />
                    ) : (
                        <DownloadIconSelected />
                    )}
                </div>
            )}
            {previewImageUrl && (
                <div className="download-button__preview-image">
                    <img src={previewImageUrl} style={imageStyle} />
                </div>
            )}
            <div className="download-button__content">
                <h4 className="download-button__title">{title}</h4>
                <div className="download-button__description-wrapper">
                    <p className="download-button__description">
                        {description}
                    </p>
                    {showLoading && (
                        <p className="download-button__loading-label">
                            Loading…
                        </p>
                    )}
                </div>
            </div>
            <div className="download-button__download-icon">
                {showLoading ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                ) : (
                    <FontAwesomeIcon icon={faDownload} />
                )}
            </div>
        </button>
    )
}
