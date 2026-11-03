import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

/** Offers AI search for the query above the standard results */
export const SearchAiTeaser = ({
    query,
    onStart,
}: {
    query: string
    onStart: () => void
}) => (
    <div className="search-ai-teaser col-start-2 span-cols-12">
        <FontAwesomeIcon
            className="search-ai-teaser__icon"
            icon={faWandMagicSparkles}
        />
        <div className="search-ai-teaser__text">
            <p className="search-ai-teaser__title">
                See our most useful work on <strong>“{query}”</strong>, picked
                by AI <span className="search-ai-teaser__beta">Beta</span>
            </p>
            <p className="search-ai-teaser__note">
                AI chooses the charts and articles that best answer your search
                from the results below and lays them out as a page, often in
                sections by theme. It takes about ten seconds.
            </p>
        </div>
        <button
            type="button"
            className="search-ai-teaser__button"
            onClick={onStart}
        >
            Try AI search
        </button>
    </div>
)
