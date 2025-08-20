import { match } from "ts-pattern"
import {
    ChartRecordType,
    ExplorerType,
    SearchChartHit,
    SearchChartHitComponentProps,
} from "./searchTypes.js"
import { SearchChartHitSmall } from "./SearchChartHitSmall.js"
import { SearchChartHitRichData } from "./SearchChartHitRichData.js"
import { SearchChartHitRichDataFallback } from "./SearchChartHitRichDataFallback.js"

export const SearchChartHitComponent = (
    props: SearchChartHitComponentProps & {
        variant: "medium" | "small"
    }
) => {
    const { variant, ...componentProps } = props
    return match(variant)
        .with("medium", () => <SearchChartHitMedium {...componentProps} />)
        .with("small", () => <SearchChartHitSmall {...componentProps} />)
        .exhaustive()
}

const SearchChartHitMedium = (
    props: SearchChartHitComponentProps
): React.ReactElement => {
    return hasRichDataDisplay(props.hit) ? (
        <SearchChartHitRichData {...props} numDataTableRowsPerColumn={4} />
    ) : (
        <SearchChartHitRichDataFallback {...props} />
    )
}

function hasRichDataDisplay(hit: SearchChartHit): boolean {
    // CSV-based explorers don't support rich data display
    return !(
        hit.type === ChartRecordType.ExplorerView &&
        hit.explorerType === ExplorerType.Csv
    )
}
