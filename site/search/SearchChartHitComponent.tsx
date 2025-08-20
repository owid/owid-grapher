import { match } from "ts-pattern"
import { useMediaQuery } from "usehooks-ts"
import { SearchChartHitSmall } from "./SearchChartHitSmall.js"
import {
    ChartRecordType,
    ExplorerType,
    SearchChartHit,
    SearchChartHitComponentProps,
    SearchChartHitComponentVariant,
} from "./searchTypes.js"
import { SearchChartHitRichData } from "./SearchChartHitRichData.js"
import { SearchChartHitRichDataFallback } from "./SearchChartHitRichDataFallback.js"
import { MEDIUM_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"

export const SearchChartHitComponent = (
    props: SearchChartHitComponentProps & {
        variant: SearchChartHitComponentVariant
    }
) => {
    const { variant, ...componentProps } = props
    return match(variant)
        .with("large", () => <SearchChartHitLarge {...componentProps} />)
        .with("medium", () => <SearchChartHitLarge {...componentProps} />)
        .with("small", () => <SearchChartHitLarge {...componentProps} />)
        .exhaustive()
}

const SearchChartHitMedium = (
    props: SearchChartHitComponentProps
): React.ReactElement => {
    // If the hit doesn't support rich data display, render the fallback component
    if (!hasRichDataDisplay(props.hit))
        return <SearchChartHitRichDataFallback {...props} />

    return <SearchChartHitRichData variant="medium" {...props} />
}

const SearchChartHitLarge = (
    props: SearchChartHitComponentProps
): React.ReactElement => {
    const isMediumScreen = useMediaQuery(MEDIUM_BREAKPOINT_MEDIA_QUERY)

    // If the hit doesn't support rich data display, render the fallback component
    if (!hasRichDataDisplay(props.hit))
        return <SearchChartHitRichDataFallback {...props} />

    // On smaller screens, render the medium variant which implements the
    // mobile layout for smaller viewports
    if (isMediumScreen) return <SearchChartHitMedium {...props} />

    return <SearchChartHitRichData variant="large" {...props} />
}

function hasRichDataDisplay(hit: SearchChartHit): boolean {
    // CSV-based explorers don't support rich data display
    return !(
        hit.type === ChartRecordType.ExplorerView &&
        hit.explorerType === ExplorerType.Csv
    )
}
