import { getCanonicalUrl } from "@ourworldindata/components"
import DataInsightDateline from "../gdocs/components/DataInsightDateline.js"
import { getIndexName } from "./searchClient.js"
import { DataInsightHit, SearchIndexName } from "./searchTypes.js"
import cx from "classnames"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { OwidGdocType } from "@ourworldindata/types"

export const SearchDataInsightHit = ({
    hit,
    className,
}: {
    hit: DataInsightHit
    className?: string
}) => {
    const href = getCanonicalUrl("", {
        slug: hit.slug,
        content: {
            type: OwidGdocType.DataInsight,
        },
    })

    return (
        <SearchAsDraft name="Data Insight" className={className}>
            <a
                href={href}
                data-algolia-index={getIndexName(SearchIndexName.Pages)}
                data-algolia-object-id={hit.objectID}
                data-algolia-position={hit.__position}
                className={cx("search-data-insight-hit")}
            >
                {hit.thumbnailUrl && (
                    <img
                        src={hit.thumbnailUrl}
                        className="search-data-insight-hit__img"
                    />
                )}
                <DataInsightDateline
                    className="search-data-insight-hit-dateline"
                    publishedAt={new Date(hit.date)}
                    formatOptions={{
                        year: "numeric",
                        month: "long",
                        day: "2-digit",
                    }}
                />
                <h4 className="search-data-insight-hit__title">{hit.title}</h4>
            </a>
        </SearchAsDraft>
    )
}
