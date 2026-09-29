import { useCallback, useMemo } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import { parseAsInteger, parseAsString, parseAsStringEnum } from "nuqs"
import { findClosestTime } from "@ourworldindata/utils"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { Spinner } from "../../../../components/Spinner/Spinner.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import { EmbedConfigProvider } from "../../../../hooks/useEmbedConfig.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"
import {
    isUserLocationCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"
import { formatEntityNameForSentence } from "../../../../helpers/entityNames.js"
import type { VariantProps } from "../../../../helpers/config.js"
import type { BespokeComponentDataUrls } from "owid-bespoke-types"

import { FoodSupplyChainControls } from "../components/FoodSupplyChainControls.js"
import {
    doesVerticalLayoutFit,
    FoodSupplyChainWaterfall,
} from "../components/FoodSupplyChainWaterfall.js"
import { FoodSupplyChainWaterfallHorizontal } from "../components/FoodSupplyChainWaterfallHorizontal.js"
import { FoodSupplyChainConfig } from "../core/config.js"
import { VERTICAL_CHART_HEIGHT } from "../core/constants.js"
import {
    queryClient,
    useEntityData,
    useFoodSupplyChainManifest,
} from "../core/data.js"
import { MEASURES, Measure } from "../core/types.js"
import { buildSubtitle, buildTitle } from "../core/title.js"
import {
    buildWaterfall,
    findExcludedStageKeys,
    Waterfall,
} from "../core/waterfall.js"

const DEFAULT_ENTITY_SLUG = "world"
const DEFAULT_MEASURE: Measure = "energy"
const LATEST_YEAR = Infinity

const FOOTER_NOTE =
    "Figures are per person per day, from the FAO's Supply Utilization Accounts. A country that re-exports food can show far more entering its food system than its own population could eat."

export function WaterfallVariant({
    config,
    urls,
}: VariantProps<FoodSupplyChainConfig>): React.ReactElement {
    return (
        <EmbedConfigProvider config={config}>
            <NuqsAdapter>
                <QueryClientProvider client={queryClient}>
                    <div className="food-supply-chain-chart">
                        <FetchingWaterfallVariant config={config} urls={urls} />
                    </div>
                </QueryClientProvider>
            </NuqsAdapter>
        </EmbedConfigProvider>
    )
}

function FetchingWaterfallVariant({
    config,
    urls,
}: {
    config: FoodSupplyChainConfig
    urls: BespokeComponentDataUrls
}): React.ReactElement {
    const isUserLocation = isUserLocationCountry(config.country)
    const initialCountrySlugOrName =
        config.country && !isUserLocation ? config.country : DEFAULT_ENTITY_SLUG

    const [countrySlugOrName, setCountrySlug] = useUrlState({
        key: "foodSupplyChainCountry",
        parser: parseAsString,
        defaultValue: initialCountrySlugOrName,
    })
    const [measure, setMeasure] = useUrlState({
        key: "foodSupplyChainMeasure",
        parser: parseAsStringEnum<Measure>([...MEASURES]),
        defaultValue: DEFAULT_MEASURE,
    })
    const [selectedYear, setYear] = useUrlState({
        key: "foodSupplyChainYear",
        parser: parseAsInteger,
        defaultValue: LATEST_YEAR,
    })

    const { data: manifest, status: manifestStatus } =
        useFoodSupplyChainManifest(urls.metadataUrl)

    const setCountry = useCallback(
        (name: string) => {
            const slug = manifest?.entityByName.get(name)?.slug
            if (slug) setCountrySlug(slug)
        },
        [manifest, setCountrySlug]
    )

    const availableCountryNames = useMemo(
        () =>
            manifest
                ? new Set(manifest.entities.map((e) => e.name))
                : undefined,
        [manifest]
    )
    const { isResolved: isCountryResolved } = useResolveUserLocation({
        configCountry: config.country,
        availableCountryNames,
        urlStateKey: "foodSupplyChainCountry",
        setCountry,
    })

    const entity =
        manifest?.entityBySlug.get(countrySlugOrName) ??
        manifest?.entityByName.get(countrySlugOrName)
    const {
        data: entityData,
        status: entityStatus,
        isPlaceholderData,
    } = useEntityData(entity?.id, urls.dataUrl)
    const isLoading = useDelayedLoading(isPlaceholderData)

    const year = entityData
        ? (findClosestTime(entityData.years, selectedYear) ?? selectedYear)
        : selectedYear
    const waterfall = useMemo(
        () =>
            manifest && entity && entityData
                ? buildWaterfall({
                      manifest,
                      entityData,
                      measure,
                      year,
                      excludedStageKeys: findExcludedStageKeys(entity.slug),
                  })
                : undefined,
        [manifest, entity, entityData, measure, year]
    )

    if (manifestStatus === "pending")
        return <ChartSkeleton className="food-supply-chain-chart-box" />
    if (manifestStatus === "error" || !manifest)
        return <ChartError className="food-supply-chain-chart-box" />
    if (!entity) return <ChartError className="food-supply-chain-chart-box" />
    if (entityStatus === "pending" || !isCountryResolved)
        return <ChartSkeleton className="food-supply-chain-chart-box" />
    if (entityStatus === "error" || !entityData)
        return <ChartError className="food-supply-chain-chart-box" />

    return (
        <>
            {!config.hideControls && (
                <FoodSupplyChainControls
                    manifest={manifest}
                    entityName={entity.name}
                    measure={measure}
                    year={year}
                    years={entityData.years}
                    setEntityName={setCountry}
                    setMeasure={setMeasure}
                    setYear={setYear}
                />
            )}
            <Frame className="food-supply-chain-captioned-chart">
                <ChartHeader
                    title={config.title ?? buildTitle(entity.name, measure)}
                    subtitle={config.subtitle ?? buildSubtitle(measure, year)}
                />
                <div className="food-supply-chain-captioned-chart__chart-area">
                    {isLoading && <Spinner />}
                    {waterfall ? (
                        <MeasuredWaterfall waterfall={waterfall} />
                    ) : (
                        <NoDataMessage entityName={entity.name} year={year} />
                    )}
                </div>
                <ChartFooter
                    source={manifest.sources.join("; ")}
                    note={FOOTER_NOTE}
                />
            </Frame>
        </>
    )
}

function MeasuredWaterfall({
    waterfall,
}: {
    waterfall: Waterfall
}): React.ReactElement {
    const { ref, width } = useContainerWidth()

    const isHorizontal = !doesVerticalLayoutFit(waterfall, width)

    return (
        <div ref={ref}>
            {width > 0 &&
                (isHorizontal ? (
                    <FoodSupplyChainWaterfallHorizontal
                        waterfall={waterfall}
                        width={width}
                    />
                ) : (
                    <FoodSupplyChainWaterfall
                        waterfall={waterfall}
                        width={width}
                        height={VERTICAL_CHART_HEIGHT}
                    />
                ))}
        </div>
    )
}

function NoDataMessage({
    entityName,
    year,
}: {
    entityName: string
    year: number
}): React.ReactElement {
    return (
        <div className="food-supply-chain-captioned-chart__no-data">
            No data for {formatEntityNameForSentence(entityName)} in {year}.
        </div>
    )
}
