import { useCallback, useEffect, useMemo, useState } from "react"
import cx from "clsx"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import { parseAsBoolean, parseAsInteger, parseAsString } from "nuqs"

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
    buildTrajectory,
    getSliderYears,
    getValuesFromYear,
} from "../core/scatterData.js"
import type {
    AxisRange,
    DemocracyAxis,
    IndicatorData,
    IndicatorKey,
    ScatterPoint,
    TrajectoryPoint,
} from "../core/types.js"
import {
    DemocracyControls,
    NO_COUNTRY,
} from "../components/DemocracyControls.js"
import { ScatterGrid } from "../components/ScatterGrid.js"

const queryClient = new QueryClient()

const DEFAULT_DEMOCRACY_AXIS: DemocracyAxis = "x"
/** How long the play button rests on each year */
const PLAY_INTERVAL_MS = 700

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
    const [selectedCountry, setSelectedCountry] = useUrlState({
        key: "democracyCountry",
        parser: parseAsString,
        defaultValue: config.country ?? NO_COUNTRY,
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
            selectedCountry={selectedCountry}
            setYear={setYear}
            setColorByRegion={setColorByRegion}
            setSizeByPopulation={setSizeByPopulation}
            setFixedAxes={setFixedAxes}
            setSelectedCountry={setSelectedCountry}
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
    selectedCountry,
    setYear,
    setColorByRegion,
    setSizeByPopulation,
    setFixedAxes,
    setSelectedCountry,
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
    selectedCountry: string
    setYear: (year: number) => void
    setColorByRegion: (value: boolean) => void
    setSizeByPopulation: (value: boolean) => void
    setFixedAxes: (value: boolean) => void
    setSelectedCountry: (name: string) => void
}): React.ReactElement {
    const years = useMemo(
        () => getSliderYears(democracy, START_YEAR),
        [democracy]
    )
    const latestYear = years[years.length - 1]
    const year = years.includes(requestedYear) ? requestedYear : latestYear

    const democracyAxis = config.democracyAxis ?? DEFAULT_DEMOCRACY_AXIS

    // Play: step through the years, stopping at the last one. Any manual
    // change of the year while playing also stops it, via the effect below.
    const [isPlaying, setIsPlaying] = useState(false)
    const togglePlaying = useCallback(() => {
        if (!isPlaying && year === latestYear) setYear(years[0])
        setIsPlaying((playing) => !playing)
    }, [isPlaying, year, latestYear, years, setYear])
    useEffect(() => {
        if (!isPlaying) return
        if (year >= latestYear) {
            setIsPlaying(false)
            return
        }
        const timer = window.setTimeout(
            () => setYear(year + 1),
            PLAY_INTERVAL_MS
        )
        return () => window.clearTimeout(timer)
    }, [isPlaying, year, latestYear, setYear])

    const countries = useMemo(() => [...democracy.byEntity.keys()], [democracy])
    const selectedEntity =
        selectedCountry && democracy.byEntity.has(selectedCountry)
            ? selectedCountry
            : undefined

    // The highlighted country's path is only needed for one country at a
    // time, so it is built on demand and cached until the year changes
    const getTrajectory = useMemo(() => {
        const cache = new Map<string, TrajectoryPoint[]>()
        return (entityName: string, key: IndicatorKey): TrajectoryPoint[] => {
            const cacheKey = `${key}:${entityName}`
            let path = cache.get(cacheKey)
            if (!path) {
                path = buildTrajectory({
                    democracy,
                    indicator: indicators[key],
                    entityName,
                    fromYear: START_YEAR,
                    toYear: year,
                    tolerance: MATCH_TOLERANCE_YEARS,
                })
                cache.set(cacheKey, path)
            }
            return path
        }
    }, [democracy, indicators, year])

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
                    selectedEntity={selectedEntity}
                    getTrajectory={getTrajectory}
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
                    countries={countries}
                    selectedCountry={selectedEntity ?? NO_COUNTRY}
                    isPlaying={isPlaying}
                    isPopulationLoading={isPopulationLoading}
                    setYear={setYear}
                    setColorByRegion={setColorByRegion}
                    setSizeByPopulation={setSizeByPopulation}
                    setFixedAxes={setFixedAxes}
                    setSelectedCountry={setSelectedCountry}
                    togglePlaying={togglePlaying}
                />
            )}
        </>
    )
}
