import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import { DownloadIconFull } from "../icons/DownloadIconFull.js"
import { DownloadIconSelected } from "../icons/DownloadIconSelected.js"

export function DownloadButtonLink({
    className,
    title,
    description,
    icon,
    trackingNote,
    href,
    download,
}: {
    className?: string
    title: string
    description: string
    icon?: "full" | "selected"
    trackingNote?: string
    href: string
    download?: string
}) {
    return (
        <a
            className={cx("download-button", className)}
            href={href}
            download={download}
            data-track-note={trackingNote}
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
            <div className="download-button__content">
                <h4 className="download-button__title">{title}</h4>
                <div className="download-button__description-wrapper">
                    <p className="download-button__description">
                        {description}
                    </p>
                </div>
            </div>
            <div className="download-button__download-icon">
                <FontAwesomeIcon icon={faDownload} />
            </div>
        </a>
    )
}
