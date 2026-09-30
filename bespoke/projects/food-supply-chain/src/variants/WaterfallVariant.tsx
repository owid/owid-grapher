import { useMemo } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import { parseAsInteger, parseAsString, parseAsStringEnum } from "nuqs"
import { findClosestTime } from "@ourworldindata/utils"
import { WORLD_ENTITY_NAME } from "@ourworldindata/grapher/src/core/GrapherConstants.js"

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
    findInitialCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"
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
    useFoodSupplyChainMetadata,
} from "../core/data.js"
import { MEASURES, Measure } from "../core/types.js"
import { buildSubtitle, buildTitle } from "../core/text.js"
import {
    buildWaterfall,
    findExcludedStageKeys,
    Waterfall,
} from "../core/waterfall.js"

const DEFAULT_ENTITY_NAME = WORLD_ENTITY_NAME
const DEFAULT_MEASURE: Measure = "energy"
const LATEST_YEAR = Infinity

export function WaterfallVariant({
    config,
    urls,
}: VariantProps<FoodSupplyChainConfig>): React.ReactElement {
    return (
        <EmbedConfigProvider config={config}>
            <NuqsAdapter>
                <QueryClientProvider client={queryClient}>
                    <FetchingWaterfallVariant config={config} urls={urls} />
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
    const initialCountryName = findInitialCountry(
        config.country,
        DEFAULT_ENTITY_NAME
    )

    const [countryName, setCountry] = useUrlState({
        key: "country",
        parser: parseAsString,
        defaultValue: initialCountryName,
    })
    const [measure, setMeasure] = useUrlState({
        key: "measure",
        parser: parseAsStringEnum<Measure>([...MEASURES]),
        defaultValue: DEFAULT_MEASURE,
    })
    const [selectedYear, setYear] = useUrlState({
        key: "year",
        parser: parseAsInteger,
        defaultValue: LATEST_YEAR,
    })

    const { data: metadata, status: metadataStatus } =
        useFoodSupplyChainMetadata(urls.metadataUrl)

    const { isResolved: isCountryResolved } = useResolveUserLocation({
        configCountry: config.country,
        availableCountryNames: metadata?.entityNames,
        urlStateKey: "country",
        setCountry,
    })

    const entity = metadata?.entityByName.get(countryName)
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
            metadata && entity && entityData
                ? buildWaterfall({
                      metadata,
                      entityData,
                      measure,
                      year,
                      excludedStageKeys: findExcludedStageKeys(entity.name),
                  })
                : undefined,
        [metadata, entity, entityData, measure, year]
    )

    if (metadataStatus === "pending")
        return <ChartSkeleton className="food-supply-chain-chart-box" />
    if (metadataStatus === "error" || !metadata)
        return <ChartError className="food-supply-chain-chart-box" />
    if (!entity) return <ChartError className="food-supply-chain-chart-box" />
    if (entityStatus === "pending" || !isCountryResolved)
        return <ChartSkeleton className="food-supply-chain-chart-box" />
    if (entityStatus === "error" || !entityData || !waterfall)
        return <ChartError className="food-supply-chain-chart-box" />

    return (
        <>
            {!config.hideControls && (
                <FoodSupplyChainControls
                    metadata={metadata}
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
                    <MeasuredWaterfall waterfall={waterfall} />
                </div>
                <ChartFooter source={metadata.sources.join("; ")} />
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
