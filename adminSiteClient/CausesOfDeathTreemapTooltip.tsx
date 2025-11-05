import cx from "classnames"
import {
    CAUSE_OF_DEATH_CATEGORY_COLORS,
    TooltipState,
} from "./CausesOfDeathConstants.js"
import { TooltipCore } from "@ourworldindata/grapher/src/tooltip/Tooltip"
import { TooltipValueCore } from "@ourworldindata/grapher/src/tooltip/TooltipContents"
import {
    formatCountryName,
    formatNumberLongText,
    formatPercentSigFig,
} from "./CausesOfDeathHelpers.js"
import { GrapherTooltipAnchor } from "@ourworldindata/types"

export function CausesOfDeathTreemapTooltip({
    state,
    anchor,
    containerWidth,
    containerHeight,
    offsetX = 8,
    offsetY = 8,
}: {
    state: TooltipState
    anchor?: GrapherTooltipAnchor
    containerWidth: number
    containerHeight: number
    offsetX?: number
    offsetY?: number
}) {
    const { target, position } = state

    if (!target) return null

    const node = target.node
    const variable = node.data.data.variable
    const value = node.value || 0
    const year = node.data.data.year

    // Get total deaths from root node
    const totalDeaths = node.ancestors()[node.ancestors().length - 1].value || 0

    const labelVariant = "unit-only"
    const unit = "Deaths"
    const color = undefined
    const displayValue = formatNumberLongText(value)

    console.log("variable:", variable)
    const categoryColor =
        CAUSE_OF_DEATH_CATEGORY_COLORS[node.data.data.category ?? ""] ||
        "#5b5b5b"

    const locationDescription =
        node.data.data.entityName === "World"
            ? "globally"
            : `in ${formatCountryName(node.data.data.entityName)}`

    return (
        <TooltipCore
            id="causes-of-death-tooltip"
            x={position.x}
            y={position.y}
            offsetX={offsetX}
            offsetY={offsetY}
            title={variable}
            subtitle={year.toString()}
            style={{ maxWidth: 300 }}
            // TODO: does this make sense here?
            containerWidth={containerWidth}
            containerHeight={containerHeight}
            anchor={anchor}
        >
            <div
                className={cx("variable", {
                    "variable--no-name": labelVariant === "unit-only",
                })}
            >
                <div className="values" style={{ color }}>
                    <span>
                        {formatPercentSigFig(value / totalDeaths)}{" "}
                        <span style={{ fontWeight: 400 }}>died from </span>
                        <span style={{ fontWeight: 400 }}>
                            {variable === variable.toUpperCase()
                                ? variable
                                : variable.toLowerCase()}
                        </span>{" "}
                        <span style={{ fontWeight: 400 }}>
                            in {year}, totaling
                        </span>{" "}
                        {displayValue} deaths
                        {/* <span style={{ fontWeight: 400 }}>
                            {" "}
                            {locationDescription}
                        </span> */}
                    </span>
                </div>
            </div>
            {/* <div
                className={cx("variable", {
                    "variable--no-name": labelVariant === "unit-only",
                })}
            >
                <div className="definition">
                    {unit && unit.length > 1 && (
                        <span className="unit">{unit}</span>
                    )}
                </div>
                <div className="values" style={{ color }}>
                    <span>{displayValue}</span>{" "}
                    <span
                        style={{
                            color: "#858585",
                            fontWeight: 400,
                            fontSize: "0.8em",
                            // fontStyle: "italic",
                        }}
                    >
                        &nbsp;
                        {`(of ${formatNumberLongText(totalDeaths)} total)`}
                    </span>
                </div>
            </div> */}
            {/* <TooltipValueCore
                value={value / totalDeaths}
                displayInfo={{
                    // displayName: "Share of all deaths",
                    unit: "Share of deaths",
                }}
                valueFormatter={{
                    formatValue: (v) => formatPercentSigFig(v),
                }}
                labelVariant="unit-only"
            /> */}
        </TooltipCore>
    )
}
