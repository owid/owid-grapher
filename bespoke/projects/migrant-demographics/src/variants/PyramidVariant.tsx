import { useMemo } from "react"
import cx from "clsx"
import { QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import {
    parseAsBoolean,
    parseAsInteger,
    parseAsString,
    parseAsStringEnum,
} from "nuqs"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { Spinner } from "../../../../components/Spinner/Spinner.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import {
    isUserLocationCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"

import { PyramidVariantConfig } from "../config.js"
import { ShowMode, VariantProps } from "../types.js"
import {
    MigrantDemographics,
    queryClient,
    useMigrantDemographics,
} from "../data.js"
import {
    computeAxisMax,
    computePyramidView,
    formatCountLong,
    formatSexShare,
} from "../helpers.js"
import { entityNameForSentence } from "../entityNames.js"
import {
    DEFAULT_COUNTRY,
    NARROW_BREAKPOINT,
    NATIVE_LINE_COLOR,
    WORLD_ENTITY_NAME,
} from "../constants.js"
import { MigrantPyramid } from "../components/MigrantPyramid.js"
import { PyramidControls } from "../components/PyramidControls.js"

export function PyramidVariant({
    config,
}: VariantProps<PyramidVariantConfig>): React.ReactElement {
    const { width, ref } = useContainerWidth()
    const isNarrow = width > 0 && width < NARROW_BREAKPOINT

    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <div
                    ref={ref}
                    className={cx("migrant-pyramid", {
                        "migrant-pyramid--narrow": isNarrow,
                    })}
                >
                    <FetchingPyramidVariant
                        config={config}
                        isNarrow={isNarrow}
                    />
                </div>
            </QueryClientProvider>
        </NuqsAdapter>
    )
}

function FetchingPyramidVariant({
    config,
    isNarrow,
}: {
    config: PyramidVariantConfig
    isNarrow: boolean
}): React.ReactElement {
    const urlSync = config.urlSync ?? false

    const initialCountry =
        !config.country || isUserLocationCountry(config.country)
            ? DEFAULT_COUNTRY
            : config.country

    const [country, setCountry] = useUrlState({
        key: "migrantPyramidCountry",
        parser: parseAsString,
        defaultValue: initialCountry,
        enabled: urlSync,
    })
    const [year, setYear] = useUrlState({
        key: "migrantPyramidYear",
        parser: parseAsInteger,
        defaultValue: config.year ?? 0, // 0 = latest available year
        enabled: urlSync,
    })
    const [show, setShow] = useUrlState({
        key: "migrantPyramidShow",
        parser: parseAsStringEnum<ShowMode>(["number", "share"]),
        defaultValue: config.show ?? "number",
        enabled: urlSync,
    })
    const [compare, setCompare] = useUrlState({
        key: "migrantPyramidCompare",
        parser: parseAsBoolean,
        defaultValue: config.compare ?? false,
        enabled: urlSync,
    })

    const { data, status } = useMigrantDemographics()

    const availableCountryNames = useMemo(
        () => (data ? new Set(data.entityNames) : undefined),
        [data]
    )
    const { isResolved: isCountryResolved } = useResolveUserLocation({
        configCountry: config.country,
        availableCountryNames,
        urlSync,
        urlStateKey: "migrantPyramidCountry",
        setCountry,
    })

    if (status === "pending" || !isCountryResolved) return <PyramidSkeleton />
    if (status === "error" || !data)
        return (
            <PyramidError message="Failed to load the migrant demographics data" />
        )

    // Fall back gracefully when the config or URL asks for something the
    // data doesn't have
    const selectedCountry = data.hasEntity(country) ? country : DEFAULT_COUNTRY
    const selectedYear = data.years.includes(year)
        ? year
        : data.years[data.years.length - 1]

    return (
        <CaptionedPyramidVariant
            config={config}
            data={data}
            country={selectedCountry}
            year={selectedYear}
            show={show}
            compare={compare}
            isNarrow={isNarrow}
            setCountry={setCountry}
            setYear={setYear}
            setShow={setShow}
            setCompare={setCompare}
        />
    )
}

function CaptionedPyramidVariant({
    config,
    data,
    country,
    year,
    show,
    compare,
    isNarrow,
    setCountry,
    setYear,
    setShow,
    setCompare,
}: {
    config: PyramidVariantConfig
    data: MigrantDemographics
    country: string
    year: number
    show: ShowMode
    compare: boolean
    isNarrow: boolean
    setCountry: (name: string) => void
    setYear: (year: number) => void
    setShow: (show: ShowMode) => void
    setCompare: (compare: boolean) => void
}): React.ReactElement {
    // Comparing absolute numbers is meaningless (there are far more
    // native-born residents), so comparison always shows shares
    const mode: ShowMode = compare ? "share" : show

    const pyramidData = useMemo(
        () => data.getPyramidData(country, year),
        [data, country, year]
    )
    const view = useMemo(
        () =>
            pyramidData
                ? computePyramidView(pyramidData, mode, compare)
                : undefined,
        [pyramidData, mode, compare]
    )
    // Fixed across years so the axis is stable while dragging the slider
    const xMax = useMemo(
        () => computeAxisMax(data, country, mode, compare),
        [data, country, mode, compare]
    )

    const title = config.title ?? chartTitle(country, year)
    const subtitle =
        config.subtitle ??
        (pyramidData
            ? chartSubtitle(country, pyramidData.migrantsTotal.total)
            : undefined)

    return (
        <div className="migrant-pyramid-chart">
            {!config.hideControls && (
                <PyramidControls
                    data={data}
                    country={country}
                    year={year}
                    show={show}
                    compare={compare}
                    setCountry={setCountry}
                    setYear={setYear}
                    setShow={setShow}
                    setCompare={setCompare}
                />
            )}
            <Frame className="migrant-pyramid-captioned-chart">
                <ChartHeader title={title} subtitle={subtitle} />
                {/* Always rendered so toggling the comparison doesn't
                    shift the chart below */}
                <div
                    className={cx("migrant-pyramid-legend", {
                        "migrant-pyramid-legend--hidden": !compare,
                    })}
                    aria-hidden={!compare}
                >
                    <span
                        className="migrant-pyramid-legend__line"
                        style={{ backgroundColor: NATIVE_LINE_COLOR }}
                    />
                    Native-born residents
                </div>
                <div className="migrant-pyramid-captioned-chart__chart-area">
                    {view && pyramidData ? (
                        <MigrantPyramid
                            ageBands={data.ageBands}
                            view={view}
                            xMax={xMax}
                            mode={mode}
                            axisLabel={
                                mode === "share"
                                    ? compare
                                        ? "Share of each population"
                                        : "Share of all immigrants"
                                    : "Number of immigrants"
                            }
                            menLabel={{
                                name: "Men",
                                annotation:
                                    formatSexShare(
                                        pyramidData.migrantsTotal.men,
                                        pyramidData.migrantsTotal.total
                                    ) || undefined,
                            }}
                            womenLabel={{
                                name: "Women",
                                annotation:
                                    formatSexShare(
                                        pyramidData.migrantsTotal.women,
                                        pyramidData.migrantsTotal.total
                                    ) || undefined,
                            }}
                            isNarrow={isNarrow}
                        />
                    ) : (
                        <div className="migrant-pyramid__no-data">
                            No data for {country} in {year}.
                        </div>
                    )}
                </div>
                <ChartFooter
                    source={data.source}
                    note="Immigrants are people living in a country or area other than the one where they were born. Native-born residents are calculated as the total resident population minus the international migrant stock."
                />
            </Frame>
        </div>
    )
}

function chartTitle(country: string, year: number): string {
    if (country === WORLD_ENTITY_NAME)
        return `Population pyramid of immigrants worldwide in ${year}`
    return `Population pyramid of immigrants living in ${entityNameForSentence(country)} in ${year}`
}

function chartSubtitle(country: string, total: number): string {
    const count = formatCountLong(total)
    if (country === WORLD_ENTITY_NAME)
        return `The age and sex profile of the ${count} people worldwide living outside their country of birth.`
    return `The age and sex profile of the ${count} people living in ${entityNameForSentence(country)} who were born elsewhere.`
}

function PyramidSkeleton(): React.ReactElement {
    return (
        <div className="migrant-pyramid-skeleton">
            <Spinner />
        </div>
    )
}

function PyramidError({ message }: { message: string }): React.ReactElement {
    return <div className="migrant-pyramid__error">{message}</div>
}
