import { useMemo, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import * as R from "remeda"

import { Time } from "@ourworldindata/types"

import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"

import {
    CONTINENT_OPTIONS,
    DEFAULT_CONTINENT,
    DEFAULT_GROUP_BY,
    DEFAULT_POVERTY_LINE_CENTS,
    DEFAULT_YEAR,
    GroupBy,
    POVERTY_LINES,
    WhereAreThePoorConfig,
    WORLD_SELECTION,
} from "../helpers/PovertyConstants.js"
import { useHeadcountData } from "../helpers/PovertyDataFetching.js"
import { WhereAreThePoorCaptionedChart } from "./WhereAreThePoorCaptionedChart.js"
import { PovertyControls } from "./PovertyControls.js"
import { PovertyTreemapSpinner } from "./PovertyTreemapSpinner.js"

const queryClient = new QueryClient()

export function WhereAreThePoorChartWithProviders(props: {
    container?: HTMLDivElement
    config?: WhereAreThePoorConfig
}): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <WhereAreThePoorChart config={props.config} />
        </QueryClientProvider>
    )
}

function WhereAreThePoorChart(props: {
    config?: WhereAreThePoorConfig
}): React.ReactElement {
    const { config } = props

    // State
    const [povertyLineCents, setPovertyLineCents] = useState(
        POVERTY_LINES.find((line) => line.cents === config?.povertyLine)
            ?.cents ?? DEFAULT_POVERTY_LINE_CENTS
    )
    const [groupBy, setGroupBy] = useState<GroupBy>(
        config?.groupBy ?? DEFAULT_GROUP_BY
    )
    const [continent, setContinent] = useState(
        CONTINENT_OPTIONS.find((option) => option === config?.continent) ??
            DEFAULT_CONTINENT
    )
    const [year, setYear] = useState<Time | undefined>(config?.year)

    // Load the data for the selected poverty line
    const { data, years, status, isPlaceholderData } =
        useHeadcountData(povertyLineCents)

    // Restrict the data to the selected continent
    const scopedData = useMemo(
        () =>
            continent === WORLD_SELECTION
                ? data
                : data?.filter((row) => row.continent === continent),
        [data, continent]
    )

    // Only show loading overlays after 300ms delay to prevent flashing
    const isLoadingData = useDelayedLoading(isPlaceholderData, 300)

    const activeYear =
        years && years.length > 0
            ? R.clamp(year ?? DEFAULT_YEAR, {
                  min: years[0],
                  max: years[years.length - 1],
              })
            : undefined

    if (status === "error") return <WhereAreThePoorChartError />
    if (status === "pending") return <WhereAreThePoorSkeleton />

    // Sanity check
    if (
        !scopedData ||
        scopedData.length === 0 ||
        !years ||
        activeYear === undefined
    )
        return <WhereAreThePoorChartError />

    return (
        <div className="where-are-the-poor-chart">
            {!config?.hideControls && (
                <PovertyControls
                    povertyLineCents={povertyLineCents}
                    groupBy={groupBy}
                    continent={continent}
                    years={years}
                    year={activeYear}
                    setPovertyLineCents={setPovertyLineCents}
                    setGroupBy={setGroupBy}
                    setContinent={setContinent}
                    setYear={setYear}
                />
            )}
            <WhereAreThePoorCaptionedChart
                data={scopedData}
                povertyLineCents={povertyLineCents}
                groupBy={groupBy}
                continent={continent}
                year={activeYear}
                isLoading={isLoadingData}
            />
        </div>
    )
}

function WhereAreThePoorChartError() {
    return <div>The visualization can't be loaded</div>
}

function WhereAreThePoorSkeleton() {
    return (
        <div className="where-are-the-poor-skeleton">
            <PovertyTreemapSpinner />
        </div>
    )
}
