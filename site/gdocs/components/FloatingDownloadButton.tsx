import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons"

interface FloatingDownloadButtonProps {
    label: string
    onClick: () => void
    containerClassName?: string
}

export function FloatingDownloadButton({
    label,
    onClick,
    containerClassName,
}: FloatingDownloadButtonProps) {
    return (
        <div
            className={cx(
                "article-block__image-download-button-container",
                containerClassName
            )}
        >
            <button
                aria-label={label}
                className="article-block__image-download-button"
                onClick={(event) => {
                    event.preventDefault()
                    onClick()
                }}
            >
                <div className="article-block__image-download-button-background-layer">
                    <FontAwesomeIcon
                        icon={faDownload}
                        className="article-block__image-download-button-icon"
                    />

                    <span className="article-block__image-download-button-text">
                        {label}
                    </span>
                </div>
            </button>
        </div>
    )
}
