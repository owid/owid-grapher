import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { getCanonicalPath } from "@ourworldindata/components"
import { FeaturedVizHit, OwidGdocType } from "@ourworldindata/types"
import { formatAuthors } from "@ourworldindata/utils"
import { getPageTypeNameAndIcon } from "./searchUtils.js"

/** The featured viz at the top of the Data results: a short, single-row
 *  card linking to the featured-viz page. */
export const SearchFeaturedVizHit = ({
    hit,
    onClick,
}: {
    hit: FeaturedVizHit
    onClick: VoidFunction
}) => {
    const { name, icon } = getPageTypeNameAndIcon(OwidGdocType.FeaturedViz)
    const authors = hit.authors ?? []

    return (
        <a
            className="search-featured-viz-hit"
            href={getCanonicalPath(hit.slug, OwidGdocType.FeaturedViz)}
            onClick={onClick}
        >
            <div className="search-featured-viz-hit__label">
                <FontAwesomeIcon
                    className="search-featured-viz-hit__label-icon"
                    icon={icon}
                />
                {name}
            </div>
            <article className="search-featured-viz-hit__content">
                {/* The indexer sends "" when the featured image is missing
                    from Cloudflare, as for articles */}
                {hit.thumbnailUrl && (
                    <img
                        src={hit.thumbnailUrl}
                        role="presentation"
                        className="search-featured-viz-hit__image"
                        alt=""
                    />
                )}
                <div className="search-featured-viz-hit__text">
                    <h3 className="search-featured-viz-hit__title">
                        {hit.title}
                    </h3>
                    {authors.length > 0 && (
                        <p className="search-featured-viz-hit__authors">
                            By {formatAuthors(authors)}
                        </p>
                    )}
                    {hit.excerpt && (
                        <p className="search-featured-viz-hit__excerpt">
                            {hit.excerpt}
                        </p>
                    )}
                </div>
            </article>
        </a>
    )
}
