import { commafyNumber } from "@ourworldindata/utils"

export const SearchResultHeader = ({
    count,
    children,
}: {
    count: number
    children: React.ReactNode
}) => {
    return (
        <div className="search-result-header">
            <h2 className="search-result-header__title">{children}</h2>
            <span className="search-result-header__count">
                ({commafyNumber(count)} {count === 1 ? "result" : "results"})
            </span>
        </div>
    )
}
