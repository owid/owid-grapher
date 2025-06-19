import { commafyNumber } from "@ourworldindata/utils"
import { AsDraft } from "../AsDraft/AsDraft.js"

export const SearchResultHeader = ({
    title,
    count,
}: {
    title: string
    count: number
}) => {
    return (
        <AsDraft name="Result Header" className="search-result-header">
            <div className="search-result-header__content">
                <h2 className="search-result-header__title">{title}</h2>

                <p className="search-result-header__count">
                    ({commafyNumber(count)} {count === 1 ? "result" : "results"}
                    )
                </p>
            </div>
        </AsDraft>
    )
}
