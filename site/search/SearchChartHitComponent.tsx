import { SearchChartHitMedium } from "./SearchChartHitMedium.js"
import { SearchChartHit } from "./searchTypes.js"
import { match } from "ts-pattern"
import { SearchChartHitSmall } from "./SearchChartHitSmall.js"
import { Region } from "@ourworldindata/utils"

export const SearchChartHitComponent = ({
    hit,
    mode,
    searchQueryRegionsMatches,
    onClick,
}: {
    hit: SearchChartHit
    mode: "medium" | "small"
    searchQueryRegionsMatches?: Region[] | undefined
    onClick?: () => void
}) =>
    match(mode)
        .with("medium", () => (
            <SearchChartHitMedium
                onClick={onClick}
                hit={hit}
                searchQueryRegionsMatches={searchQueryRegionsMatches}
            />
        ))
        .with("small", () => (
            <SearchChartHitSmall
                onClick={onClick}
                hit={hit}
                searchQueryRegionsMatches={searchQueryRegionsMatches}
            />
        ))
        .exhaustive()
