import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { SearchResultType } from "@ourworldindata/types"
import { buildSearchHrefForCard } from "../search/searchState.js"
import {
    PerspectiveItem,
    RelatedArticleLink,
    RelatedDataLink,
    type PerspectiveSectionProps,
} from "./PerspectiveItem.js"

export function Sidebar({
    page,
    selectedId,
    onSelect,
    withRelated = true,
}: PerspectiveSectionProps & {
    /** False when the related sections are shown elsewhere, e.g. below the chart */
    withRelated?: boolean
}) {
    return (
        <section className="perspectives" aria-label="Data perspectives">
            <h2 className="perspectives__heading">
                Interesting views of this chart
            </h2>
            <div className="perspectives__content">
                <div className="perspectives__items">
                    {page.perspectives.map((perspective) => (
                        <PerspectiveItem
                            key={perspective.id}
                            page={page}
                            perspective={perspective}
                            selected={selectedId === perspective.id}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
                {withRelated && <RelatedSections page={page} />}
            </div>
        </section>
    )
}

/** Related data and articles, listed like the perspectives */
export function RelatedSections({
    page,
}: Pick<PerspectiveSectionProps, "page">) {
    return (
        <>
            {page.relatedData && (
                <section aria-label="Related data">
                    <h3 className="perspectives__heading">Related data</h3>
                    <div className="perspectives__items">
                        {page.relatedData.items.map((item) => (
                            <RelatedDataLink key={item.slug} item={item} />
                        ))}
                    </div>
                    <a
                        className="perspectives__see-all"
                        href={buildSearchHrefForCard(
                            SearchResultType.DATA,
                            page.relatedData.topic
                        )}
                    >
                        <span>
                            See all our charts on {page.relatedData.topicLabel}
                        </span>
                        <FontAwesomeIcon icon={faArrowRight} />
                    </a>
                </section>
            )}
            {page.relatedArticles && (
                <section aria-label="Related articles">
                    <h3 className="perspectives__heading">Related articles</h3>
                    <div className="perspectives__items">
                        {page.relatedArticles.items.map((item) => (
                            <RelatedArticleLink
                                key={item.slug}
                                item={item}
                                imageWidth={224}
                            />
                        ))}
                    </div>
                    <a
                        className="perspectives__see-all"
                        href={buildSearchHrefForCard(
                            SearchResultType.WRITING,
                            page.relatedArticles.topic
                        )}
                    >
                        <span>
                            See all our writing on{" "}
                            {page.relatedArticles.topicLabel}
                        </span>
                        <FontAwesomeIcon icon={faArrowRight} />
                    </a>
                </section>
            )}
        </>
    )
}
