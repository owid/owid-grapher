import { useMemo } from "react"
import cx from "clsx"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import { parseAsBoolean, parseAsInteger } from "nuqs"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import { EmbedConfigProvider } from "../../../../hooks/useEmbedConfig.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import { combineStatuses } from "../../../../helpers/queryStatus.js"
import type { VariantProps } from "../../../../helpers/config.js"

import type { ScatterVariantConfig } from "../core/config.js"
import {
    DEFAULT_TITLE,
    INDICATOR_SPECS,
    MATCH_TOLERANCE_YEARS,
    START_YEAR,
} from "../core/constants.js"
import {
    useDemocracyIndicator,
    useDevelopmentIndicators,
    usePopulationIndicator,
} from "../core/data.js"
import { computeAxisRange } from "../core/layout.js"
import {
    buildScatterPoints,
    getSliderYears,
    getValuesFromYear,
} from "../core/scatterData.js"
import type {
    AxisRange,
    DemocracyAxis,
    IndicatorData,
    IndicatorKey,
    ScatterPoint,
} from "../core/types.js"
import { DemocracyControls } from "../components/DemocracyControls.js"
import { ScatterGrid } from "../components/ScatterGrid.js"

const queryClient = new QueryClient()

const DEFAULT_DEMOCRACY_AXIS: DemocracyAxis = "x"

export function ScatterVariant({
    config,
}: VariantProps<ScatterVariantConfig>): React.ReactElement {
    const { width, ref } = useContainerWidth()

    return (
        <EmbedConfigProvider config={config}>
            <NuqsAdapter>
                <QueryClientProvider client={queryClient}>
                    <div
                        ref={ref}
                        className={cx("democracy-development", {
                            "democracy-development--narrow":
                                width > 0 && width < 560,
                        })}
                    >
                        {width > 0 && (
                            <FetchingScatterVariant config={config} />
                        )}
                    </div>
                </QueryClientProvider>
            </NuqsAdapter>
        </EmbedConfigProvider>
    )
}

function FetchingScatterVariant({
    config,
}: {
    config: ScatterVariantConfig
}): React.ReactElement {
    const [colorByRegion, setColorByRegion] = useUrlState({
        key: "democracyColorByRegion",
        parser: parseAsBoolean,
        defaultValue: config.colorByRegion ?? false,
    })
    const [sizeByPopulation, setSizeByPopulation] = useUrlState({
        key: "democracySizeByPopulation",
        parser: parseAsBoolean,
        defaultValue: config.sizeByPopulation ?? false,
    })
    const [fixedAxes, setFixedAxes] = useUrlState({
        key: "democracyFixedAxes",
        parser: parseAsBoolean,
        defaultValue: config.fixedAxes ?? false,
    })
    // 0 stands for "the latest year" until the data says what that is
    const [requestedYear, setYear] = useUrlState({
        key: "democracyYear",
        parser: parseAsInteger,
        defaultValue: config.year ?? 0,
    })

    const democracy = useDemocracyIndicator()
    const indicators = useDevelopmentIndicators()
    const population = usePopulationIndicator(sizeByPopulation)

    const status = combineStatuses(
        democracy.status,
        ...INDICATOR_SPECS.map((spec) => indicators[spec.key].status)
    )

    if (status === "pending")
        return <ChartSkeleton className="democracy-development__box" />
    if (status === "error" || !democracy.data)
        return <ChartError className="democracy-development__box" />

    const indicatorData = Object.fromEntries(
        INDICATOR_SPECS.map((spec) => [spec.key, indicators[spec.key].data])
    ) as Record<IndicatorKey, IndicatorData | undefined>
    if (INDICATOR_SPECS.some((spec) => !indicatorData[spec.key]))
        return <ChartError className="democracy-development__box" />

    return (
        <CaptionedScatterVariant
            config={config}
            democracy={democracy.data}
            indicators={indicatorData as Record<IndicatorKey, IndicatorData>}
            population={population.data}
            isPopulationLoading={sizeByPopulation && population.isPending}
            requestedYear={requestedYear}
            colorByRegion={colorByRegion}
            sizeByPopulation={sizeByPopulation}
            fixedAxes={fixedAxes}
            setYear={setYear}
            setColorByRegion={setColorByRegion}
            setSizeByPopulation={setSizeByPopulation}
            setFixedAxes={setFixedAxes}
        />
    )
}

function CaptionedScatterVariant({
    config,
    democracy,
    indicators,
    population,
    isPopulationLoading,
    requestedYear,
    colorByRegion,
    sizeByPopulation,
    fixedAxes,
    setYear,
    setColorByRegion,
    setSizeByPopulation,
    setFixedAxes,
}: {
    config: ScatterVariantConfig
    democracy: IndicatorData
    indicators: Record<IndicatorKey, IndicatorData>
    population: IndicatorData | undefined
    isPopulationLoading: boolean
    requestedYear: number
    colorByRegion: boolean
    sizeByPopulation: boolean
    fixedAxes: boolean
    setYear: (year: number) => void
    setColorByRegion: (value: boolean) => void
    setSizeByPopulation: (value: boolean) => void
    setFixedAxes: (value: boolean) => void
}): React.ReactElement {
    const years = useMemo(
        () => getSliderYears(democracy, START_YEAR),
        [democracy]
    )
    const latestYear = years[years.length - 1]
    const year = years.includes(requestedYear) ? requestedYear : latestYear

    const democracyAxis = config.democracyAxis ?? DEFAULT_DEMOCRACY_AXIS

    const pointsByIndicator = useMemo(
        () =>
            Object.fromEntries(
                INDICATOR_SPECS.map((spec) => [
                    spec.key,
                    buildScatterPoints({
                        democracy,
                        indicator: indicators[spec.key],
                        population: sizeByPopulation ? population : undefined,
                        year,
                        tolerance: MATCH_TOLERANCE_YEARS,
                    }),
                ])
            ) as Record<IndicatorKey, ScatterPoint[]>,
        [democracy, indicators, population, sizeByPopulation, year]
    )

    // Axis ranges either follow the selected year's dots, so the association
    // fills each panel, or cover every value since the slider's first year
    // so dots can be compared across years
    const fixedRanges = useMemo(
        () =>
            Object.fromEntries(
                INDICATOR_SPECS.map((spec) => [
                    spec.key,
                    computeAxisRange(
                        getValuesFromYear(indicators[spec.key], START_YEAR),
                        spec.scale,
                        { startAtZero: spec.startAtZero }
                    ),
                ])
            ) as Record<IndicatorKey, AxisRange>,
        [indicators]
    )
    const rangesByIndicator = useMemo(
        () =>
            fixedAxes
                ? fixedRanges
                : (Object.fromEntries(
                      INDICATOR_SPECS.map((spec) => [
                          spec.key,
                          computeAxisRange(
                              pointsByIndicator[spec.key].map(
                                  (p) => p.indicator.value
                              ),
                              spec.scale,
                              { startAtZero: spec.startAtZero }
                          ),
                      ])
                  ) as Record<IndicatorKey, AxisRange>),
        [fixedAxes, fixedRanges, pointsByIndicator]
    )

    // One entry per panel, so a reader can tell which source is behind which chart
    const sources = useMemo(() => {
        const entries: [string, IndicatorData][] = [
            ["Liberal Democracy Index", democracy],
            ...INDICATOR_SPECS.map((spec): [string, IndicatorData] => [
                spec.title,
                indicators[spec.key],
            ]),
            ...(sizeByPopulation && population
                ? [["Population", population] as [string, IndicatorData]]
                : []),
        ]
        // Semicolons separate panels, so the ones inside a curated
        // attribution ("Gapminder (2015); UN IGME (2025)") become commas
        return entries
            .map(
                ([label, data]) =>
                    `${label}: ${data.metadata.attributions
                        .join(", ")
                        .replace(/;\s*/g, ", ")}`
            )
            .join("; ")
    }, [democracy, indicators, population, sizeByPopulation])

    const subtitle =
        config.subtitle ??
        `The charts show how four measures of development relate to countries' scores on V-Dem's Liberal Democracy Index. The index covers free and fair elections, constraints on power, and civil rights. Shaded corners mark combinations no country falls into.`

    return (
        <>
            <Frame className="democracy-development__box">
                <ChartHeader
                    title={config.title ?? DEFAULT_TITLE}
                    subtitle={subtitle}
                />
                <ScatterGrid
                    pointsByIndicator={pointsByIndicator}
                    rangesByIndicator={rangesByIndicator}
                    year={year}
                    democracyAxis={democracyAxis}
                    colorByRegion={colorByRegion}
                    sizeByPopulation={sizeByPopulation}
                    showTriangles
                />
                <ChartFooter source={sources} />
            </Frame>
            {!config.hideControls && (
                <DemocracyControls
                    years={years}
                    year={year}
                    colorByRegion={colorByRegion}
                    sizeByPopulation={sizeByPopulation}
                    fixedAxes={fixedAxes}
                    isPopulationLoading={isPopulationLoading}
                    setYear={setYear}
                    setColorByRegion={setColorByRegion}
                    setSizeByPopulation={setSizeByPopulation}
                    setFixedAxes={setFixedAxes}
                />
            )}
        </>
    )
}
