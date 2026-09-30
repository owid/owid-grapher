import cx from "clsx"

import { CONNECTOR_WIDTH } from "../core/constants.js"
import { PlacedLine } from "../core/waterfallLayout.js"

export function FoodSupplyChainConnector({
    line,
    color,
    isDimmed,
}: {
    line: PlacedLine
    color: string
    isDimmed: boolean
}): React.ReactElement {
    return (
        <line
            className={cx(
                "food-supply-chain-waterfall__connector",
                isDimmed && "food-supply-chain-waterfall__connector--dimmed"
            )}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={color}
            strokeWidth={CONNECTOR_WIDTH}
        />
    )
}
