import { useCallback, useMemo } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import { parseAsInteger, parseAsString, parseAsStringEnum } from "nuqs"

import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { useChartDimensions } from "../../../../hooks/useDimensions.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import { EmbedConfigProvider } from "../../../../hooks/useEmbedConfig.js"
import {
    isUserLocationCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"
import type { VariantProps } from "../../../../helpers/config.js"
import type { BespokeComponentDataUrls } from "owid-bespoke-types"

import { FoodSupplyChainControls } from "../components/FoodSupplyChainControls.js"
import { FoodSupplyChainWaterfall } from "../components/FoodSupplyChainWaterfall.js"
import { FoodSupplyChainConfig } from "../core/config.js"
import { clampYear } from "../core/clampYear.js"
import {
    queryClient,
    useEntityData,
    useFoodSupplyChainManifest,
} from "../core/data.js"
import { MEASURES, Measure } from "../core/types.js"
import { buildWaterfall, Waterfall } from "../core/waterfall.js"

// The World region: a stable OWID region slug, unlike entity ids.
const DEFAULT_ENTITY_SLUG = "world"
const DEFAULT_MEASURE: Measure = "energy"
/** Later than any year the data has, so the clamp lands on the entity's latest */
const DEFAULT_YEAR = 9999

// Matches the fixed height of the skeleton and error boxes below.
const CHART_DIMENSIONS_CONFIG = { minHeight: 400, maxHeight: 400 }

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
    const isUserLocation = isUserLocationCountry(config.country)
    const initialCountrySlug =
        config.country && !isUserLocation ? config.country : DEFAULT_ENTITY_SLUG

    const [countrySlug, setCountrySlug] = useUrlState({
        key: "foodSupplyChainCountry",
        parser: parseAsString,
        defaultValue: initialCountrySlug,
    })
    const [measure, setMeasure] = useUrlState({
        key: "foodSupplyChainMeasure",
        parser: parseAsStringEnum<Measure>([...MEASURES]),
        defaultValue: DEFAULT_MEASURE,
    })
    const [selectedYear, setYear] = useUrlState({
        key: "foodSupplyChainYear",
        parser: parseAsInteger,
        defaultValue: DEFAULT_YEAR,
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

    // The URL carries a slug; the config carries a country name, as authors write it
    const entity =
        manifest?.entityBySlug.get(countrySlug) ??
        manifest?.entityByName.get(countrySlug)
    const { data: entityData, status: entityStatus } = useEntityData(
        entity?.id,
        urls.dataUrl
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

    const year = clampYear(entityData.years, selectedYear) ?? selectedYear

    const waterfall = buildWaterfall({ manifest, entityData, measure, year })
    if (!waterfall)
        return <ChartError className="food-supply-chain-chart-box" />

    return (
        <>
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
            <MeasuredWaterfall waterfall={waterfall} />
        </>
    )
}

function MeasuredWaterfall({
    waterfall,
}: {
    waterfall: Waterfall
}): React.ReactElement {
    const { ref, dimensions } = useChartDimensions<HTMLDivElement>({
        config: CHART_DIMENSIONS_CONFIG,
    })

    return (
        <div ref={ref}>
            {dimensions.width > 0 && dimensions.height > 0 && (
                <FoodSupplyChainWaterfall
                    waterfall={waterfall}
                    width={dimensions.width}
                    height={dimensions.height}
                />
            )}
        </div>
    )
}
