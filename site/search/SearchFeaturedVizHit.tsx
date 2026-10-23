import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { getCanonicalPath } from "@ourworldindata/components"
import {
    DEFAULT_GDOC_FEATURED_IMAGE,
    FeaturedVizHit,
    OwidGdocType,
} from "@ourworldindata/types"
import { formatAuthors } from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../../settings/clientSettings.mjs"
import { getPageTypeNameAndIcon } from "./searchUtils.js"

// Same fallback as the indexer uses for pages without a featured image
const DEFAULT_THUMBNAIL_URL = `${BAKED_BASE_URL}/${DEFAULT_GDOC_FEATURED_IMAGE}`

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
    // The indexer sends "" when it can't find the featured image in
    // Cloudflare. An empty square would look broken in this slot.
    const thumbnailUrl = hit.thumbnailUrl || DEFAULT_THUMBNAIL_URL
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
                <img
                    src={thumbnailUrl}
                    role="presentation"
                    className="search-featured-viz-hit__image"
                    alt=""
                />
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
