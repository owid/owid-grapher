import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons"
import { SearchEmptyState } from "./SearchEmptyState.js"

/**
 * Shown when the search backend failed, in place of the "no results" notice.
 * The distinction matters: telling readers there are no results for their
 * query when we couldn't search at all sends them away believing we have
 * nothing on the topic — hence the reassurance that the content is still
 * there, and no promise about when search will be back.
 */
export const SearchError = ({
    heading = "Search isn’t working right now.",
}: {
    heading?: string
} = {}) => {
    return (
        <SearchEmptyState
            icon={faTriangleExclamation}
            heading={heading}
            subtitle={
                <p className="body-3-medium">
                    This is a problem on our end. Our charts and articles are
                    all still there — you can browse them by topic from the site
                    menu.
                </p>
            }
        />
    )
}
