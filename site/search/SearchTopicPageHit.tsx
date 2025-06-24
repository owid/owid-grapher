import { getCanonicalPath } from "@ourworldindata/components"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { TopicPageHit } from "./searchTypes.js"

export const SearchTopicPageHit = ({ hit }: { hit: TopicPageHit }) => (
    <SearchAsDraft name={"Topic Page Hit"}>
        <a
            href={getCanonicalPath(hit.slug, hit.type)}
            className="search-topic-page-hit"
        >
            <div className="search-topic-page-hit__content">
                <header className="search-topic-page-hit__header">
                    <h3 className="search-topic-page-hit__title">
                        {hit.title}
                    </h3>
                </header>
                <div className="search-topic-page-hit__excerpt">
                    {hit.excerpt}
                </div>
            </div>
        </a>
    </SearchAsDraft>
)
