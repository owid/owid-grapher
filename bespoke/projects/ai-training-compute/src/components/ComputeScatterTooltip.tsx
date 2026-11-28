import { GrapherTooltipAnchor } from "@ourworldindata/types"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"
import { TooltipFooterIcon } from "@ourworldindata/grapher/src/tooltip/TooltipProps.js"
import { GRAY_70 } from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { ColorScheme } from "../core/constants.js"
import { formatFlopInWords, formatScientific } from "../core/formatFlop.js"
import {
    COLOR_SCHEME_DEFINITIONS,
    getGroupColor,
} from "../core/colorSchemes.js"
import {
    COMPUTER_KIND_LABELS,
    getMonthOfComputation,
} from "../core/computers.js"
import { LANDMARKS } from "../core/landmarks.js"
import { CONFIDENCE_FACTORS, getComputeRange } from "../core/uncertainty.js"
import { FrontierTooltip } from "./FrontierRow.js"
import type { HoverTarget } from "./ComputeScatter.js"

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
})

function formatFlop(value: number): string {
    return `${formatFlopInWords(value)} FLOP`
}

export function ComputeScatterTooltip({
    target,
    position,
    containerBounds,
    isPinned,
    colorScheme,
}: {
    target: HoverTarget
    position: { x: number; y: number }
    containerBounds?: { width: number; height: number }
    isPinned: boolean
    colorScheme: ColorScheme
}) {
    const common = {
        id: "ai-training-compute-tooltip",
        x: position.x,
        y: position.y,
        offsetX: 12,
        offsetY: 12,
        containerBounds,
        anchor: isPinned ? GrapherTooltipAnchor.Bottom : undefined,
        style: { maxWidth: 320 },
    }

    if (target.kind === "reference") {
        const { reference } = target
        return (
            <TooltipCard
                {...common}
                title={reference.label}
                subtitle={
                    reference.kind === "threshold"
                        ? "Regulatory threshold"
                        : "Human comparison"
                }
            >
                <TooltipValue
                    label="Computation"
                    value={formatFlop(reference.flop)}
                    detail={formatScientific(reference.flop)}
                    color={GRAY_70}
                />
                <p className="compute-scatter-tooltip__description">
                    {reference.description}
                </p>
            </TooltipCard>
        )
    }

    if (target.kind === "computer") {
        const { computer } = target
        const month = getMonthOfComputation(computer)
        return (
            <TooltipCard
                {...common}
                title={computer.name}
                subtitle={`${COMPUTER_KIND_LABELS[computer.kind]} · ${computer.year}`}
            >
                <TooltipValue
                    label="Running flat out for one month"
                    value={formatFlop(month)}
                    detail={formatScientific(month)}
                    color={GRAY_70}
                />
                <p className="compute-scatter-tooltip__description">
                    {computer.description}
                </p>
            </TooltipCard>
        )
    }

    if (target.kind === "frontier")
        return (
            <FrontierTooltip
                segment={target.segment}
                isPlotted={target.isPlotted}
                common={common}
            />
        )

    const { model } = target
    const group = model.groups[colorScheme]
    const color = getGroupColor(colorScheme, group)
    const landmark = LANDMARKS[model.model]
    const range = getComputeRange(model.trainingComputeFlop, model.confidence)
    const footer = model.link
        ? [
              {
                  icon: TooltipFooterIcon.None,
                  text: isPinned
                      ? "Tap the dot again to open the source"
                      : "Click to open the source",
              },
          ]
        : undefined

    return (
        <TooltipCard
            {...common}
            title={model.model}
            subtitle={`${model.organization} · ${DATE_FORMAT.format(model.date)}`}
            footer={footer}
        >
            {landmark && (
                <p className="compute-scatter-tooltip__description compute-scatter-tooltip__description--lead">
                    {landmark.description}
                </p>
            )}
            <TooltipValue
                label="Training computation"
                value={formatFlop(model.trainingComputeFlop)}
                detail={formatScientific(model.trainingComputeFlop)}
                color={color}
            />
            <TooltipValue
                label={COLOR_SCHEME_DEFINITIONS[colorScheme].label}
                value={group}
                color={color}
            />
            {model.domain && colorScheme !== "domain" && (
                <TooltipValue
                    label="Domain (Epoch's tags)"
                    value={model.domain.split(",").join(", ")}
                    color={GRAY_70}
                />
            )}
            {range && (
                <TooltipValue
                    label="90% uncertainty range"
                    value={`${formatFlopInWords(range[0])} – ${formatFlopInWords(range[1])} FLOP`}
                    detail={`Epoch rates the estimate \u201c${model.confidence}\u201d (\u00b1${CONFIDENCE_FACTORS[model.confidence ?? ""]}\u00d7)`}
                    color={GRAY_70}
                />
            )}
        </TooltipCard>
    )
}
