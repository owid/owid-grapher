import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faFlask,
    faUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons"
import { BespokeComponent } from "../gdocs/components/BespokeComponent.js"
import { FEATURED_VIZ_ITEMS, FeaturedVizItem } from "./featuredVizContent.js"

export const FEATURED_VIZ_PAGE_ROOT_ID = "featured-viz-page-root"

const EMBED_LAYOUT_CLASSES: Record<string, string> = {
    narrow: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
    wide: "col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
    widest: "span-cols-12 col-start-2",
}

const formatAuthors = (authors: string[]): string => {
    if (authors.length <= 1) return authors.join("")
    return `${authors.slice(0, -1).join(", ")} and ${authors[authors.length - 1]}`
}

const FeaturedVizSection = ({ item }: { item: FeaturedVizItem }) => {
    return (
        <section
            id={item.id}
            className="featured-viz-page__section grid grid-cols-12-full-width"
        >
            <div className="featured-viz-page__section-header grid grid-cols-12 span-cols-12 col-start-2">
                <div className="featured-viz-page__section-intro span-cols-7 span-md-cols-12">
                    <span className="featured-viz-page__eyebrow overline-black-caps">
                        {item.eyebrow}
                    </span>
                    <h2 className="h2-bold">
                        {item.title}
                        {item.draftPreviewUrl && (
                            <span className="featured-viz-page__draft-badge">
                                <FontAwesomeIcon icon={faFlask} />
                                Work in progress
                            </span>
                        )}
                    </h2>
                    <p className="body-2-regular">{item.description}</p>
                </div>
                <div className="featured-viz-page__section-highlights span-cols-4 col-start-9 span-md-cols-12 col-md-start-1">
                    <h3 className="overline-black-caps">Things to try</h3>
                    <ul>
                        {item.highlights.map((highlight) => (
                            <li key={highlight.text}>
                                <FontAwesomeIcon icon={highlight.icon} />
                                <span>{highlight.text}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div
                className={cx(
                    "featured-viz-page__embed",
                    EMBED_LAYOUT_CLASSES[item.block.size] ??
                        EMBED_LAYOUT_CLASSES.widest
                )}
            >
                <BespokeComponent block={item.block} />
            </div>
            <div className="featured-viz-page__section-footer span-cols-12 col-start-2">
                <span className="featured-viz-page__authors body-3-medium">
                    By {formatAuthors(item.authors)}
                </span>
                {item.articleUrl && (
                    <a
                        className="featured-viz-page__article-link body-3-medium"
                        href={item.articleUrl}
                        data-track-note="featured_viz_article_link"
                    >
                        Read the article
                        <FontAwesomeIcon icon={faArrowRight} />
                    </a>
                )}
                {item.draftPreviewUrl && (
                    <a
                        className="featured-viz-page__article-link body-3-medium"
                        href={item.draftPreviewUrl}
                        data-track-note="featured_viz_draft_link"
                    >
                        Preview the draft article (staging)
                        <FontAwesomeIcon icon={faUpRightFromSquare} />
                    </a>
                )}
            </div>
        </section>
    )
}

export const FeaturedVizDashboard = () => {
    return (
        <div className="featured-viz-page">
            <header className="featured-viz-page__header grid grid-cols-12-full-width">
                <div className="featured-viz-page__header-content span-cols-12 col-start-2">
                    <div className="featured-viz-page__prototype-notice body-3-medium">
                        <FontAwesomeIcon icon={faFlask} />
                        Prototype — an internal preview, not a published page
                    </div>
                    <h1 className="h1-semibold">Featured visualizations</h1>
                    <p className="featured-viz-page__subtitle subtitle-1">
                        Some questions need more than a standard chart. These
                        interactive visualizations were custom-built by our team
                        to let you explore the data behind big global questions
                        — every one of them is live on this page, so dive in and
                        play.
                    </p>
                    <nav
                        className="featured-viz-page__jump-nav"
                        aria-label="Featured visualizations on this page"
                    >
                        <span className="overline-black-caps">
                            On this page
                        </span>
                        <ul>
                            {FEATURED_VIZ_ITEMS.map((item) => (
                                <li key={item.id}>
                                    <a href={`#${item.id}`}>{item.eyebrow}</a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>
            </header>
            {FEATURED_VIZ_ITEMS.map((item) => (
                <FeaturedVizSection item={item} key={item.id} />
            ))}
        </div>
    )
}
