import { GrapherTooltipAnchor } from "@ourworldindata/types"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"
import { GRAY_70 } from "@ourworldindata/grapher/src/color/ColorConstants.js"

import { AiModel, ColorBy } from "../core/constants.js"
import { formatFlopInWords, formatScientific } from "../core/formatFlop.js"
import { getColor } from "../core/colorSchemes.js"
import { LANDMARKS } from "../core/landmarks.js"
import { CONFIDENCE_FACTORS, getComputeRange } from "../core/uncertainty.js"

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
})

export function ComputeTooltip({
    model,
    position,
    containerBounds,
    isPinned,
    colorBy,
}: {
    model: AiModel
    position: { x: number; y: number }
    containerBounds?: { width: number; height: number }
    isPinned: boolean
    colorBy: ColorBy
}) {
    const color = getColor(colorBy, model)
    const range = getComputeRange(model.trainingComputeFlop, model.confidence)
    const landmark = LANDMARKS[model.model]
    return (
        <TooltipCard
            id="ai-training-compute-tooltip"
            x={position.x}
            y={position.y}
            offsetX={12}
            offsetY={12}
            title={model.model}
            subtitle={DATE_FORMAT.format(model.date)}
            containerBounds={containerBounds}
            anchor={isPinned ? GrapherTooltipAnchor.Bottom : undefined}
            style={{ maxWidth: 320 }}
        >
            {landmark && (
                <p className="compute-tooltip__description">
                    {landmark.description}
                </p>
            )}
            <TooltipValue
                label="Training computation"
                value={`${formatFlopInWords(model.trainingComputeFlop)} FLOP`}
                detail={formatScientific(model.trainingComputeFlop)}
                color={color}
            />
            {range && model.confidence && (
                <TooltipValue
                    label="90% uncertainty range"
                    value={`${formatFlopInWords(range[0])} – ${formatFlopInWords(range[1])} FLOP`}
                    detail={`Epoch AI rates the estimate “${model.confidence.toLowerCase()}” (±${CONFIDENCE_FACTORS[model.confidence]}×)`}
                    color={GRAY_70}
                />
            )}
            {model.reporting && (
                <TooltipValue
                    label="Compute figure"
                    value={model.reporting}
                    color={colorBy === "reporting" ? color : GRAY_70}
                />
            )}
            {model.developer && (
                <TooltipValue
                    label="Developer"
                    value={model.developer}
                    color={colorBy === "developer" ? color : GRAY_70}
                />
            )}
        </TooltipCard>
    )
}
