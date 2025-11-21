import { TocHeadingWithTitleSupertitle } from "@ourworldindata/utils"

const DEFAULT_TITLE = "Contents"

type Props = {
    toc?: TocHeadingWithTitleSupertitle[]
    className?: string
    title?: string
}

export const LTPTableOfContents = ({ toc, className, title }: Props) => {
    if (!toc || toc.length === 0) return null

    const resolvedTitle = title ?? DEFAULT_TITLE

    return (
        <nav
            className={className}
            aria-label={`${resolvedTitle} table of contents`}
        >
            <p className="article-block__ltp-toc__title span-cols-8 span-md-cols-10 span-sm-cols-12">
                {resolvedTitle}
            </p>
            <ul className="article-block__ltp-toc__list span-cols-5 span-md-cols-7 span-sm-cols-12">
                {toc.map(({ slug, title: headingTitle, text }) => {
                    const displayTitle = headingTitle || text
                    if (!slug || !displayTitle) return null
                    return (
                        <li key={slug} className="article-block__ltp-toc__item">
                            <a
                                href={`#${slug}`}
                                className="article-block__ltp-toc__link"
                                data-track-note="toc_link"
                            >
                                {displayTitle}
                            </a>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
