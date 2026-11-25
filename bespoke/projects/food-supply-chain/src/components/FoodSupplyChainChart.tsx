import { useMemo } from "react"

import { Spinner } from "../../../../components/Spinner/Spinner.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import { VERTICAL_CHART_HEIGHT } from "../core/constants.js"
import { Waterfall } from "../core/waterfall.js"
import { doesVerticalLayoutFit } from "../core/verticalWaterfallPlan.js"
import { FoodSupplyChainWaterfall } from "./FoodSupplyChainWaterfall.js"
import { FoodSupplyChainWaterfallHorizontal } from "./FoodSupplyChainWaterfallHorizontal.js"

export function FoodSupplyChainChart({
    waterfall,
    isLoading,
}: {
    waterfall: Waterfall
    isLoading: boolean
}): React.ReactElement {
    const { width, ref } = useContainerWidth()

    const isHorizontal = useMemo(
        () => !doesVerticalLayoutFit(waterfall, width),
        [waterfall, width]
    )

    return (
        <div
            ref={ref}
            className="food-supply-chain-captioned-chart__chart-area"
        >
            {isLoading && <Spinner />}
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
