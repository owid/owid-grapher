import { Box } from "@ourworldindata/types"
import { BezierArrow } from "@ourworldindata/grapher"

import { ARROW_OPACITY, ARROW_WIDTH, COLORS } from "../core/constants.js"
import { PlacedLine } from "../core/waterfallLayout.js"

export function FoodSupplyChainBar({
    bar,
    arrow,
    color,
    showArrow,
}: {
    bar: Box
    arrow?: PlacedLine
    color: string
    showArrow: boolean
}): React.ReactElement {
    return (
        <>
            <rect
                className="food-supply-chain-waterfall__bar"
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                fill={color}
            />
            {showArrow && arrow && (
                <BezierArrow
                    className="food-supply-chain-waterfall__arrow"
                    start={{ x: arrow.x1, y: arrow.y1 }}
                    end={{ x: arrow.x2, y: arrow.y2 }}
                    width={ARROW_WIDTH}
                    color={COLORS.arrow}
                    opacity={ARROW_OPACITY}
                />
            )}
        </>
    )
}
