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
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { Spinner } from "../../../../components/Spinner/Spinner.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import { EmbedConfigProvider } from "../../../../hooks/useEmbedConfig.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"
import {
    isUserLocationCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"
import { formatEntityNameForSentence } from "../../../../helpers/entityNames.js"
import { combineStatuses } from "../../../../helpers/queryStatus.js"

import { PyramidVariantConfig } from "../core/config.js"
import { RawEntityYears, ShowMode } from "../core/types.js"
import type { VariantProps } from "../../../../helpers/config.js"
import type { BespokeComponentDataUrls } from "owid-bespoke-types"
import {
    computePyramidData,
    MigrantDemographicsMetadata,
    queryClient,
    useMigrantDemographicsEntity,
    useMigrantDemographicsMetadata,
} from "../core/data.js"
import {
    computeAxisMax,
    computePyramidView,
    formatCountLong,
    formatSexShare,
} from "../core/helpers.js"
import { DEFAULT_COUNTRY, NARROW_BREAKPOINT } from "../core/constants.js"
import { MigrantPyramid } from "../components/MigrantPyramid.js"
import { PyramidControls } from "../components/PyramidControls.js"

export function PyramidVariant({
    config,
    urls,
}: VariantProps<PyramidVariantConfig>): React.ReactElement {
    return (
        <EmbedConfigProvider config={config}>
            <NuqsAdapter>
                <QueryClientProvider client={queryClient}>
                    <FetchingPyramidVariant config={config} urls={urls} />
                </QueryClientProvider>
            </NuqsAdapter>
        </EmbedConfigProvider>
    )
}

function FetchingPyramidVariant({
    config,
    urls,
}: {
    config: PyramidVariantConfig
    urls: BespokeComponentDataUrls
}): React.ReactElement {
    const initialCountry =
        !config.country || isUserLocationCountry(config.country)
            ? DEFAULT_COUNTRY
            : config.country

    const [country, setCountry] = useUrlState({
        key: "migrantPyramidCountry",
        parser: parseAsString,
        defaultValue: initialCountry,
    })
    const [year, setYear] = useUrlState({
        key: "migrantPyramidYear",
        parser: parseAsInteger,
        defaultValue: config.year ?? 0, // 0 = latest available year
    })
    const [show, setShow] = useUrlState({
        key: "migrantPyramidShow",
        parser: parseAsStringEnum<ShowMode>(["number", "share"]),
        defaultValue: config.show ?? "number",
    })
    const [compare, setCompare] = useUrlState({
        key: "migrantPyramidCompare",
        parser: parseAsBoolean,
        defaultValue: config.compare,
    })

    const { data: metadata, status: metadataStatus } =
        useMigrantDemographicsMetadata(urls.metadataUrl)

    // Fall back gracefully when the config or URL asks for something the
    // data doesn't have
    const selectedCountry = metadata?.hasEntity(country)
        ? country
        : DEFAULT_COUNTRY

    const {
        data: entityYears,
        status: entityStatus,
        isPlaceholderData,
    } = useMigrantDemographicsEntity(selectedCountry, metadata, urls.dataUrl)

    const status = combineStatuses(metadataStatus, entityStatus)
    const isLoadingCountry = useDelayedLoading(isPlaceholderData)

    const availableCountryNames = useMemo(
        () => (metadata ? new Set(metadata.entityNames) : undefined),
        [metadata]
    )
    const { isResolved: isCountryResolved } = useResolveUserLocation({
        configCountry: config.country,
        availableCountryNames,
        urlStateKey: "migrantPyramidCountry",
        setCountry,
    })

    if (status === "pending")
        return <ChartSkeleton className="migrant-pyramid-chart-box" />
    if (status === "error" || !metadata || !entityYears)
        return <ChartError className="migrant-pyramid-chart-box" />
    if (!isCountryResolved)
        return <ChartSkeleton className="migrant-pyramid-chart-box" />

    const selectedYear = metadata.years.includes(year)
        ? year
        : metadata.years[metadata.years.length - 1]

    return (
        <CaptionedPyramidVariant
            config={config}
            metadata={metadata}
            entityYears={entityYears}
            country={selectedCountry}
            year={selectedYear}
            show={show}
            compare={compare}
            isLoading={isLoadingCountry}
            setCountry={setCountry}
            setYear={setYear}
            setShow={setShow}
            setCompare={setCompare}
        />
    )
}

function CaptionedPyramidVariant({
    config,
    metadata,
    entityYears,
    country,
    year,
    show,
    compare,
    isLoading,
    setCountry,
    setYear,
    setShow,
    setCompare,
}: {
    config: PyramidVariantConfig
    metadata: MigrantDemographicsMetadata
    entityYears: RawEntityYears
    country: string
    year: number
    show: ShowMode
    compare: boolean
    isLoading: boolean
    setCountry: (name: string) => void
    setYear: (year: number) => void
    setShow: (show: ShowMode) => void
    setCompare: (compare: boolean) => void
}): React.ReactElement {
    const { width, ref } = useContainerWidth()
    const isNarrow = width > 0 && width < NARROW_BREAKPOINT

    // Comparing absolute numbers is meaningless (there are far more
    // native-born residents), so comparison always shows shares
    const mode: ShowMode = compare ? "share" : show

    const pyramidData = useMemo(() => {
        const record = entityYears[String(year)]
        return record ? computePyramidData(record) : undefined
    }, [entityYears, year])
    const view = useMemo(
        () =>
            pyramidData
                ? computePyramidView(
                      pyramidData,
                      metadata.ageBands,
                      mode,
                      compare
                  )
                : undefined,
        [pyramidData, metadata.ageBands, mode, compare]
    )
    // Fixed across years so the axis is stable while dragging the slider
    const xMax = useMemo(
        () => computeAxisMax(entityYears, metadata.ageBands, mode, compare),
        [entityYears, metadata.ageBands, mode, compare]
    )

    // A year with no migrant stock at all draws an empty pyramid and makes
    // the subtitle read "the 0 people", so it gets its own message
    const total = pyramidData?.migrantsTotal.total ?? 0

    const title = config.title ?? chartTitle(country, year)
    const subtitle =
        config.subtitle ??
        (total > 0 ? chartSubtitle(country, total) : undefined)

    // The outline only appears once the comparison is switched on
    const isShowingNatives = !!view?.natives
    const canToggleNatives = !config.hideControls
    const hasLegendRow = isShowingNatives || canToggleNatives

    return (
        <div
            ref={ref}
            className={cx("migrant-pyramid", {
                "migrant-pyramid--narrow": isNarrow,
            })}
        >
            {!config.hideControls && (
                <PyramidControls
                    metadata={metadata}
                    country={country}
                    year={year}
                    mode={mode}
                    compare={compare}
                    isNarrow={isNarrow}
                    setCountry={setCountry}
                    setYear={setYear}
                    setShow={setShow}
                    setCompare={setCompare}
                />
            )}
            <Frame
                className={cx("migrant-pyramid-captioned-chart", {
                    "migrant-pyramid-captioned-chart--with-legend":
                        hasLegendRow,
                })}
            >
                <ChartHeader title={title} subtitle={subtitle} />
                {/* Kept in the layout while the comparison can still be
                    toggled, so switching it doesn't shift the chart below */}
                {hasLegendRow && (
                    <div
                        className={cx("migrant-pyramid-legend", {
                            "migrant-pyramid-legend--hidden": !isShowingNatives,
                        })}
                        aria-hidden={!isShowingNatives}
                    >
                        <span className="migrant-pyramid-legend__line" />
                        Native-born residents
                    </div>
                )}
                <div className="migrant-pyramid-captioned-chart__chart-area">
                    {isLoading && <Spinner />}
                    {view && pyramidData && total > 0 ? (
                        <MigrantPyramid
                            view={view}
                            xMax={xMax}
                            mode={mode}
                            axisLabel={
                                mode === "share"
                                    ? isShowingNatives
                                        ? "Share of each population"
                                        : "Share of all immigrants"
                                    : "Number of immigrants"
                            }
                            menLabel={{
                                name: "Men",
                                annotation: formatSexShare(
                                    pyramidData.migrantsTotal.men,
                                    pyramidData.migrantsTotal.total
                                ),
                            }}
                            womenLabel={{
                                name: "Women",
                                annotation: formatSexShare(
                                    pyramidData.migrantsTotal.women,
                                    pyramidData.migrantsTotal.total
                                ),
                            }}
                            isNarrow={isNarrow}
                        />
                    ) : (
                        <div className="migrant-pyramid__no-data">
                            {pyramidData
                                ? `No immigrants recorded in ${formatEntityNameForSentence(country)} in ${year}.`
                                : `No data for ${formatEntityNameForSentence(country)} in ${year}.`}
                        </div>
                    )}
                </div>
                <ChartFooter
                    source={metadata.source}
                    note="Immigrants are people living in a country other than the one they were born in. Native-born residents are the total resident population minus the international migrant stock. The age and sex breakdown mostly comes from national censuses. For countries with only one census since 1990, that single profile is carried across all years and scaled to population totals."
                />
            </Frame>
        </div>
    )
}

function chartTitle(country: string, year: number): string {
    return `Population pyramid of immigrants living in ${formatEntityNameForSentence(country)} in ${year}`
}

function chartSubtitle(country: string, total: number): string {
    const count = formatCountLong(total)
    return `The age and sex profile of the ${count} people living in ${formatEntityNameForSentence(country)} who were born elsewhere.`
}
