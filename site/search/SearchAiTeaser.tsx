import cx from "clsx"
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useSearchContext } from "./SearchContext.js"
import { useAiSearchSettings } from "./aiSearchClient.js"

export const SearchAiBetaBadge = () => (
    <span className="search-ai-beta-badge">Beta</span>
)

export const SearchAiIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon
        className={cx("search-ai-icon", className)}
        icon={faWandMagicSparkles}
    />
)

/** The "Try AI search" row after the autocomplete suggestions. */
export const SearchAutocompleteAiItem = ({
    id,
    query,
    isActive,
    onSelect,
    onHover,
}: {
    id?: string
    query: string
    isActive: boolean
    onSelect: () => void
    onHover: () => void
}) => (
    <li
        className={cx(
            "search-autocomplete-item",
            "search-autocomplete-ai-item",
            {
                "search-autocomplete-item--active": isActive,
            }
        )}
        role="option"
        aria-selected={isActive}
    >
        <button
            id={id}
            type="button"
            className={cx(
                "search-autocomplete-button",
                "search-autocomplete-ai-item__button",
                { "search-autocomplete-button--active": isActive }
            )}
            tabIndex={-1}
            // onMouseDown for the same reason as the other suggestions (see
            // SearchAutocomplete)
            onMouseDown={onSelect}
            onMouseEnter={onHover}
        >
            <SearchAiIcon />
            <span className="search-autocomplete-ai-item__label">
                Try AI search for <strong>“{query}”</strong>
            </span>
            <SearchAiBetaBadge />
        </button>
    </li>
)

/** Offers AI search above the standard results (a prototype setting). */
export const SearchAiTeaser = ({ query }: { query: string }) => {
    const { aiSearch } = useSearchContext()
    const [settings] = useAiSearchSettings()
    if (!settings.teaser) return null

    return (
        <div className="search-ai-teaser col-start-2 span-cols-12">
            <SearchAiIcon />
            <span>
                See our work on <strong>“{query}”</strong> grouped by theme
            </span>
            <SearchAiBetaBadge />
            <button
                type="button"
                className="search-ai-teaser__button"
                onClick={() => aiSearch.start(query)}
            >
                Try AI search
            </button>
        </div>
    )
}
