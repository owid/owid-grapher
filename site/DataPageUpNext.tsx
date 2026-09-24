import { useState, useRef, useCallback } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { UpNextArticle, UpNextBlock } from "./upNextArticles.js"
import { useSwipeStage, SwipeDirection } from "./useSwipeStage.js"

/**
 * `?dpUpNext=1`: an experimental "Up next" box in place of the Research &
 * writing section. One article at a time — swipe (or tap a dot) for the next —
 * and each card shows the article's opening paragraphs, not just a link, so
 * the reader has already started reading before they decide to click.
 */

const formatDate = (isoDate: string): string => {
    const date = new Date(`${isoDate}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return ""
    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    })
}

/** "A", "A and B", "A, B, and C" */
const formatAuthors = (authors: string[]): string => {
    if (authors.length <= 2) return authors.join(" and ")
    return `${authors.slice(0, -1).join(", ")}, and ${authors[authors.length - 1]}`
}

/** One block of the article's opening: a paragraph, section heading or list. */
function ExcerptBlock({ block }: { block: UpNextBlock }) {
    if (block.kind === "heading")
        return <h4 className="dp-up-next__subheading">{block.text}</h4>
    if (block.kind === "list")
        return (
            <ul>
                {block.items.map((item, i) => (
                    <li key={i}>{item}</li>
                ))}
            </ul>
        )
    return <p>{block.text}</p>
}

export function DataPageUpNext({ articles }: { articles: UpNextArticle[] }) {
    const [index, setIndex] = useState(0)
    const surfaceRef = useRef<HTMLElement | null>(null)
    const stageRef = useRef<HTMLDivElement | null>(null)
    const indexRef = useRef(index)
    indexRef.current = index

    const canGo = useCallback(
        (direction: SwipeDirection) =>
            direction === "left"
                ? indexRef.current < articles.length - 1
                : direction === "right"
                  ? indexRef.current > 0
                  : false,
        [articles.length]
    )

    const onCommit = useCallback((direction: SwipeDirection) => {
        setIndex((i) => i + (direction === "left" ? 1 : -1))
    }, [])

    const swipe = useSwipeStage({
        stageRef,
        // Its own surface: a swipe here moves the articles, not the page.
        surfaceRef,
        axes: { x: true, y: false },
        canGo,
        onCommit,
    })

    const jumpTo = (target: number) => {
        if (target === indexRef.current) return
        swipe.slide(target > indexRef.current ? "left" : "right", () =>
            setIndex(target)
        )
    }

    if (articles.length === 0) return null
    const article = articles[index]
    const date = formatDate(article.publishedAt)

    return (
        <section
            className="dp-up-next"
            ref={surfaceRef}
            aria-roledescription="carousel"
            aria-label="Up next"
        >
            <div className="dp-up-next__header">
                <h2 className="dp-up-next__label">
                    Up next
                    <FontAwesomeIcon
                        icon={faArrowRight}
                        className="dp-up-next__label-arrow"
                    />
                </h2>
                <span className="dp-up-next__counter">
                    {index + 1}/{articles.length}
                </span>
            </div>

            <div className="dp-up-next__viewport">
                <div className="dp-up-next__stage" ref={stageRef}>
                    <a
                        className="dp-up-next__card"
                        href={article.url}
                        aria-live="polite"
                    >
                        <h3 className="dp-up-next__title">{article.title}</h3>
                        <p className="dp-up-next__meta">
                            {article.authors.length > 0 && (
                                <span>By {formatAuthors(article.authors)}</span>
                            )}
                            {date && (
                                <time dateTime={article.publishedAt}>
                                    {date}
                                </time>
                            )}
                        </p>
                        {/* The opening of the article itself, fading out:
                            reading has already begun. */}
                        <div className="dp-up-next__excerpt">
                            {article.excerpt.map((block, i) => (
                                <ExcerptBlock key={i} block={block} />
                            ))}
                        </div>
                        <span className="dp-up-next__continue">
                            Keep reading
                            <FontAwesomeIcon icon={faArrowRight} />
                        </span>
                    </a>
                </div>
            </div>

            <ol className="dp-up-next__dots">
                {articles.map((a, i) => (
                    <li key={a.url}>
                        <button
                            type="button"
                            className={cx("dp-up-next__dot", {
                                "dp-up-next__dot--active": i === index,
                            })}
                            aria-label={`Article ${i + 1} of ${articles.length}: ${a.title}`}
                            aria-current={i === index || undefined}
                            onClick={() => jumpTo(i)}
                        />
                    </li>
                ))}
            </ol>
        </section>
    )
}
