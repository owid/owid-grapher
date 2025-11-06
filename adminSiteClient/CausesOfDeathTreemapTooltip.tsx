import {
    CAUSE_OF_DEATH_CATEGORY_COLORS,
    TooltipState,
} from "./CausesOfDeathConstants.js"
import {
    formatCountryName,
    formatNumberLongText,
    formatPercentSigFig,
} from "./CausesOfDeathHelpers.js"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
import {
    TooltipCard,
    TooltipValueCore,
} from "@ourworldindata/grapher/src/tooltip/Tooltip.js"

export function CausesOfDeathTreemapTooltip({
    state,
    anchor,
    containerBounds,
    offsetX = 8,
    offsetY = 8,
}: {
    state: TooltipState
    anchor?: GrapherTooltipAnchor
    containerBounds?: { width: number; height: number }
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
        <TooltipCard
            id="causes-of-death-tooltip"
            x={position.x}
            y={position.y}
            offsetX={offsetX}
            offsetY={offsetY}
            title={variable}
            subtitle={year.toString()}
            style={{ maxWidth: 300 }}
            containerBounds={containerBounds}
            anchor={anchor}
        >
            {/* <div
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
                    </span>
                </div>
            </div> */}
            <TooltipValueCore
                value={value / totalDeaths}
                displayInfo={{
                    // displayName: "Share of all deaths",
                    unit: "Share of deaths",
                }}
                valueFormatter={{
                    formatValueShort: (v) =>
                        formatPercentSigFig(typeof v === "number" ? v : 0),
                }}
                labelVariant="unit-only"
            />
            <TooltipValueCore
                value={value}
                displayInfo={{
                    // displayName: "Share of all deaths",
                    unit: "Per year",
                }}
                valueFormatter={{
                    formatValueShort: (v) =>
                        formatNumberLongText(typeof v === "number" ? v : 0),
                }}
                labelVariant="unit-only"
            />
            <TooltipValueCore
                value={value / 365}
                displayInfo={{
                    // displayName: "Share of all deaths",
                    unit: "Per average day",
                }}
                valueFormatter={{
                    formatValueShort: (v) =>
                        formatNumberLongText(typeof v === "number" ? v : 0),
                }}
                labelVariant="unit-only"
            />
        </TooltipCard>
    )
}
