import { match } from "ts-pattern"
import { useMediaQuery } from "usehooks-ts"
import { SearchChartHitSmall } from "./SearchChartHitSmall.js"
import {
    SearchChartHitComponentProps,
    SearchChartHitComponentVariant,
} from "./searchTypes.js"
import { SearchChartHitRichData } from "./SearchChartHitRichData.js"
import { MEDIUM_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"

export const SearchChartHitComponent = (
    props: SearchChartHitComponentProps & {
        variant: SearchChartHitComponentVariant
    }
) => {
    const { variant, ...componentProps } = props
    return match(variant)
        .with("large", () => <SearchChartHitLarge {...componentProps} />)
        .with("medium", () => <SearchChartHitMedium {...componentProps} />)
        .with("small", () => <SearchChartHitSmall {...componentProps} />)
        .exhaustive()
}

const SearchChartHitMedium = (
    props: SearchChartHitComponentProps
): React.ReactElement => {
    return <SearchChartHitRichData variant="medium" {...props} />
}

const SearchChartHitLarge = (
    props: SearchChartHitComponentProps
): React.ReactElement => {
    const isMediumScreen = useMediaQuery(MEDIUM_BREAKPOINT_MEDIA_QUERY)

    // On smaller screens, render the medium variant which implements the
    // mobile layout for smaller viewports
    if (isMediumScreen) return <SearchChartHitMedium {...props} />

    return <SearchChartHitRichData variant="large" {...props} />
}
