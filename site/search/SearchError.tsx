import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons"
import { SearchEmptyState } from "./SearchEmptyState.js"

/**
 * Shown when the search backend failed, in place of the "no results" notice.
 * The distinction matters: telling readers there are no results for their
 * query when we couldn't search at all sends them away believing we have
 * nothing on the topic.
 */
export const SearchError = () => {
    return (
        <SearchEmptyState
            icon={faTriangleExclamation}
            heading="Search is temporarily unavailable."
            subtitle={
                <p className="body-3-medium">
                    Something went wrong on our end. Please try again in a few
                    minutes.
                </p>
            }
        />
    )
}
