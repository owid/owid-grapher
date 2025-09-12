import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"

export function SearchChartHitOverlayLink({
    url,
    className,
    onClick,
    children,
    overlay,
}: {
    url: string
    className?: string
    onClick?: () => void
    children: React.ReactNode
    overlay: string
}): React.ReactElement {
    return (
        <a
            href={url}
            className={cx("search-chart-hit-captioned-link", className)}
            onClick={onClick}
        >
            {children}
            <div className="search-chart-hit-captioned-link__overlay">
                <div>
                    {overlay} <FontAwesomeIcon icon={faArrowRight} size="sm" />
                </div>
            </div>
        </a>
    )
}
