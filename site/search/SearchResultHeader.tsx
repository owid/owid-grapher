import { commafyNumber } from "@ourworldindata/utils"

export const SearchResultHeader = ({
    count,
    labsFeature,
    children,
}: {
    count: number
    // The PR number of a Labs feature that shapes these results (the Labs mark;
    // does nothing outside Labs)
    labsFeature?: string
    children: React.ReactNode
}) => {
    return (
        <div className="search-result-header" data-labs-feature={labsFeature}>
            <h2 className="search-result-header__title">{children}</h2>
            <span className="search-result-header__count">
                ({commafyNumber(count)} {count === 1 ? "result" : "results"})
            </span>
        </div>
    )
}
