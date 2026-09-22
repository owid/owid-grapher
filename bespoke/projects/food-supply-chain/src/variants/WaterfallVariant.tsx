import { QueryClientProvider } from "@tanstack/react-query"

import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { useChartDimensions } from "../../../../hooks/useDimensions.js"
import type { VariantProps } from "../../../../helpers/config.js"
import type { BespokeComponentDataUrls } from "owid-bespoke-types"

import { FoodSupplyChainWaterfall } from "../components/FoodSupplyChainWaterfall.js"
import { FoodSupplyChainConfig } from "../core/config.js"
import {
    queryClient,
    useEntityData,
    useFoodSupplyChainManifest,
} from "../core/data.js"
import { Measure } from "../core/types.js"
import { buildWaterfall, Waterfall } from "../core/waterfall.js"

// The World region: a stable OWID region slug, unlike entity ids.
const DEFAULT_ENTITY_SLUG = "world"
const DEFAULT_MEASURE: Measure = "energy"

// Matches the fixed height of the skeleton and error boxes below.
const CHART_DIMENSIONS_CONFIG = { minHeight: 400, maxHeight: 400 }

export function WaterfallVariant({
    config,
    urls,
}: VariantProps<FoodSupplyChainConfig>): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <FetchingWaterfallVariant config={config} urls={urls} />
        </QueryClientProvider>
    )
}

function FetchingWaterfallVariant({
    config: _config,
    urls,
}: {
    config: FoodSupplyChainConfig
    urls: BespokeComponentDataUrls
}): React.ReactElement {
    const { data: manifest, status: manifestStatus } =
        useFoodSupplyChainManifest(urls.metadataUrl)
    const entity = manifest?.entityBySlug.get(DEFAULT_ENTITY_SLUG)
    const { data: entityData, status: entityStatus } = useEntityData(
        entity?.id,
        urls.dataUrl
    )

    if (manifestStatus === "pending")
        return <ChartSkeleton className="food-supply-chain-chart-box" />
    if (manifestStatus === "error" || !manifest)
        return <ChartError className="food-supply-chain-chart-box" />
    if (!entity) return <ChartError className="food-supply-chain-chart-box" />
    if (entityStatus === "pending")
        return <ChartSkeleton className="food-supply-chain-chart-box" />
    if (entityStatus === "error" || !entityData)
        return <ChartError className="food-supply-chain-chart-box" />

    const year = entityData.years.at(-1)
    if (year === undefined)
        return <ChartError className="food-supply-chain-chart-box" />

    const waterfall = buildWaterfall({
        manifest,
        entityData,
        measure: DEFAULT_MEASURE,
        year,
    })
    if (!waterfall)
        return <ChartError className="food-supply-chain-chart-box" />

    return <MeasuredWaterfall waterfall={waterfall} />
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
