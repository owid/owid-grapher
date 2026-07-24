import { useMemo } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import {
    parseAsBoolean,
    parseAsInteger,
    parseAsString,
    parseAsStringLiteral,
} from "nuqs"
import * as R from "remeda"

import { Time } from "@ourworldindata/types"

import { useUrlState } from "../../../../hooks/useUrlState.js"
import { Spinner } from "../../../../components/Spinner/Spinner.js"

import { MetricMode, MigrantDemographicsConfig } from "../helpers/constants.js"
import { useMigrantDataset } from "../helpers/dataFetching.js"
import { MigrantDemographicsCaptionedChart } from "./MigrantDemographicsCaptionedChart.js"
import { MigrantDemographicsControls } from "./MigrantDemographicsControls.js"

const DEFAULT_ENTITY = "United States of America"
const DEFAULT_METRIC: MetricMode = "number"

// Sentinel meaning "the latest available year"; the concrete default isn't
// known until the data has loaded.
const LATEST_YEAR = -1

const queryClient = new QueryClient()

export function MigrantDemographicsChartWithProviders(props: {
    container?: HTMLDivElement
    config?: MigrantDemographicsConfig
}): React.ReactElement {
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <MigrantDemographicsChart config={props.config} />
            </QueryClientProvider>
        </NuqsAdapter>
    )
}

function MigrantDemographicsChart({
    config,
}: {
    config?: MigrantDemographicsConfig
}): React.ReactElement {
    const urlSync = config?.urlSync ?? false

    const [entityName, setEntityName] = useUrlState({
        key: "migrantEntity",
        parser: parseAsString,
        defaultValue: config?.entity ?? DEFAULT_ENTITY,
        enabled: urlSync,
    })
    const [year, setYear] = useUrlState<Time>({
        key: "migrantYear",
        parser: parseAsInteger,
        defaultValue: config?.year ?? LATEST_YEAR,
        enabled: urlSync,
    })
    const [metric, setMetric] = useUrlState<MetricMode>({
        key: "migrantMetric",
        parser: parseAsStringLiteral(["number", "share"]),
        defaultValue: config?.metric ?? DEFAULT_METRIC,
        enabled: urlSync,
    })
    const [compare, setCompare] = useUrlState<boolean>({
        key: "migrantCompare",
        parser: parseAsBoolean,
        defaultValue: config?.compare ?? false,
        enabled: urlSync,
    })

    const { dataset, status } = useMigrantDataset()

    const entityNames = useMemo(
        () => dataset?.entities.map((entity) => entity.name) ?? [],
        [dataset]
    )

    // Clamp the (possibly URL- or config-provided) selections to what's
    // available in the data.
    const activeEntityName =
        dataset && !dataset.hasEntity(entityName) ? DEFAULT_ENTITY : entityName
    const activeYear = dataset ? resolveYear(year, dataset.years) : year

    const pyramidData = useMemo(
        () => dataset?.getPyramidData(activeEntityName, activeYear),
        [dataset, activeEntityName, activeYear]
    )

    if (status === "error") return <MigrantDemographicsError />
    if (status === "pending" || !dataset) return <MigrantDemographicsSkeleton />
    if (!pyramidData) return <MigrantDemographicsError />

    return (
        <div className="migrant-demographics-chart">
            {!config?.hideControls && (
                <MigrantDemographicsControls
                    entityNames={entityNames}
                    entityName={activeEntityName}
                    years={dataset.years}
                    year={activeYear}
                    metric={metric}
                    compare={compare}
                    setEntityName={setEntityName}
                    setYear={setYear}
                    setMetric={setMetric}
                    setCompare={setCompare}
                />
            )}
            <MigrantDemographicsCaptionedChart
                data={pyramidData}
                source={dataset.source}
                metric={metric}
                compare={compare}
            />
        </div>
    )
}

function resolveYear(year: Time, years: Time[]): Time {
    if (years.length === 0) return year
    if (year === LATEST_YEAR) return years[years.length - 1]
    // Snap to the nearest available year within range.
    const clamped = R.clamp(year, {
        min: years[0],
        max: years[years.length - 1],
    })
    return R.firstBy(years, (y) => Math.abs(y - clamped)) ?? clamped
}

function MigrantDemographicsError(): React.ReactElement {
    return (
        <div className="migrant-demographics-error">
            The migrant demographics visualization can’t be loaded.
        </div>
    )
}

function MigrantDemographicsSkeleton(): React.ReactElement {
    return (
        <div className="migrant-demographics-skeleton">
            <Spinner />
        </div>
    )
}
