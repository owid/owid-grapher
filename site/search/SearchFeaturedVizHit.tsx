import { getCanonicalPath } from "@ourworldindata/components"
import { FeaturedVizHit, OwidGdocType } from "@ourworldindata/types"

/** The featured viz at the top of the Data results. A plain title link
 *  for now; the card design replaces it. */
export const SearchFeaturedVizHit = ({ hit }: { hit: FeaturedVizHit }) => {
    const href = getCanonicalPath(hit.slug, OwidGdocType.FeaturedViz)

    return (
        <p className="search-featured-viz-hit">
            <a href={href}>{hit.title}</a>
        </p>
    )
}
