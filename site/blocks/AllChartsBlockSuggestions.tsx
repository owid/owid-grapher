import * as React from "react"

export function AllChartsBlockSuggestions({
    terms,
    isLoading,
    onSelect,
}: {
    terms: string[]
    isLoading: boolean
    onSelect: (term: string) => void
}): React.ReactElement | null {
    if (isLoading) return <AllChartsBlockSuggestionsSkeleton />
    if (terms.length === 0) return null
    return (
        <div className="all-charts-block-suggestions">
            <span className="all-charts-block-suggestions__label">
                Suggested:
            </span>
            <ul className="all-charts-block-suggestions__list">
                {terms.map((term) => (
                    <li
                        key={term}
                        className="all-charts-block-suggestions__item"
                    >
                        <button
                            type="button"
                            className="all-charts-block-suggestions__button"
                            onClick={() => onSelect(term)}
                        >
                            {term}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function AllChartsBlockSuggestionsSkeleton(): React.ReactElement {
    return (
        <div className="all-charts-block-suggestions" aria-hidden>
            <div className="all-charts-block-suggestions__skeleton animate-pulse" />
        </div>
    )
}
