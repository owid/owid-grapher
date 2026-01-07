import cx from "classnames"

export function CaptionedLink({
    url,
    className,
    children,
    caption,
}: {
    url: string
    className?: string
    children: React.ReactNode
    caption: React.ReactNode
}): React.ReactElement {
    return (
        <a
            href={url}
            className={cx("search-chart-hit-captioned-link", className)}
        >
            {children}
            <div className="search-chart-hit-captioned-link__label">
                {caption}
            </div>
        </a>
    )
}

export function CaptionedLinkOverlay({
    children,
}: {
    children: React.ReactNode
}): React.ReactElement {
    return (
        <div className="search-chart-hit-captioned-link__overlay">
            <div className="search-chart-hit-captioned-link__cta">
                {children}
            </div>
        </div>
    )
}
