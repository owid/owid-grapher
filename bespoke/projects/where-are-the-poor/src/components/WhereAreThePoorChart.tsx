import { useCallback, useMemo, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import * as R from "remeda"

import { Time } from "@ourworldindata/types"

import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"

import {
    DEFAULT_GROUP_BY,
    DEFAULT_POVERTY_LINE_CENTS,
    DEFAULT_REGION,
    DEFAULT_YEAR,
    formatGroupLabel,
    getRegionSelectionOptions,
    GroupBy,
    POVERTY_LINES,
    WhereAreThePoorConfig,
    WORLD_SELECTION,
} from "../helpers/PovertyConstants.js"
import { getGroupForRow } from "../helpers/PovertyData.js"
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
    const [region, setRegion] = useState(() => {
        // The configured region may be given with or without the " (WB)" suffix
        const initialGroupBy = config?.groupBy ?? DEFAULT_GROUP_BY
        return (
            getRegionSelectionOptions(initialGroupBy).find(
                (option) =>
                    option === config?.region ||
                    formatGroupLabel(option) === config?.region
            ) ?? DEFAULT_REGION
        )
    })
    const [year, setYear] = useState<Time | undefined>(config?.year)

    // The region options depend on the grouping, so switching the grouping
    // resets the region selection
    const handleSetGroupBy = useCallback((newGroupBy: GroupBy) => {
        setGroupBy(newGroupBy)
        setRegion(WORLD_SELECTION)
    }, [])

    // Load the data for the selected poverty line
    const { data, years, status, isPlaceholderData } =
        useHeadcountData(povertyLineCents)

    // Restrict the data to the selected region
    const scopedData = useMemo(
        () =>
            region === WORLD_SELECTION
                ? data
                : data?.filter(
                      (row) => getGroupForRow(row, groupBy) === region
                  ),
        [data, region, groupBy]
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
                    region={region}
                    years={years}
                    year={activeYear}
                    setPovertyLineCents={setPovertyLineCents}
                    setGroupBy={handleSetGroupBy}
                    setRegion={setRegion}
                    setYear={setYear}
                />
            )}
            <WhereAreThePoorCaptionedChart
                data={scopedData}
                povertyLineCents={povertyLineCents}
                groupBy={groupBy}
                region={region}
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
