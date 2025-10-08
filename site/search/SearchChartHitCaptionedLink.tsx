import cx from "classnames"

export function CaptionedLink({
    url,
    className,
    onClick,
    children,
    caption,
}: {
    url: string
    className?: string
    onClick?: () => void
    children: React.ReactNode
    caption: string
}): React.ReactElement {
    return (
        <a
            href={url}
            className={cx("search-chart-hit-captioned-link", className)}
            onClick={onClick}
        >
            {children}
            <div className="search-chart-hit-captioned-link__label">
                {caption}
            </div>
        </a>
    )
}

export function CaptionedLinkOverlay(): React.ReactElement {
    return (
        <div className="search-chart-hit-captioned-link__overlay">
            <div className="search-chart-hit-captioned-link__cta">
                Click to explore
            </div>
        </div>
    )
}
