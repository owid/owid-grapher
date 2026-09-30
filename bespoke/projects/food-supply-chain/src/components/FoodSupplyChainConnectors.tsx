import cx from "clsx"

import { COLORS, CONNECTOR_WIDTH } from "../core/constants.js"
import { chooseStepColor } from "../core/waterfall.js"
import { PlacedLine, WaterfallLayout } from "../core/waterfallLayout.js"

/** The zero line, the connectors between bars, and the one into the total */
export function FoodSupplyChainConnectors({
    layout,
    isDimmed,
}: {
    layout: WaterfallLayout
    isDimmed: boolean
}): React.ReactElement {
    return (
        <>
            <line
                className="food-supply-chain-waterfall__zero-line"
                x1={layout.zeroLine.x1}
                y1={layout.zeroLine.y1}
                x2={layout.zeroLine.x2}
                y2={layout.zeroLine.y2}
                stroke={COLORS.zeroLine}
            />
            {layout.connectors.map((connector, index) => (
                <Connector
                    key={index}
                    line={connector.line}
                    color={chooseStepColor(connector.fromStep, false)}
                    isDimmed={isDimmed}
                />
            ))}
            {layout.totalConnector && (
                <Connector
                    line={layout.totalConnector}
                    color={COLORS.total}
                    isDimmed={isDimmed}
                />
            )}
        </>
    )
}

function Connector({
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
