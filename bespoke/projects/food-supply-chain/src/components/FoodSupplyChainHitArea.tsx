import { Box } from "@ourworldindata/types"

import { StageKey } from "../core/types.js"

export function FoodSupplyChainHitArea({
    stepKey,
    box,
    onStepMouseEnter,
    onStepMouseMove,
    onStepMouseLeave,
}: {
    stepKey: StageKey
    box: Box
    onStepMouseEnter: (stepKey: StageKey, event: React.MouseEvent) => void
    onStepMouseMove: (event: React.MouseEvent) => void
    onStepMouseLeave: () => void
}): React.ReactElement {
    return (
        <rect
            className="food-supply-chain-waterfall__hit-area"
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            fill="transparent"
            onMouseEnter={(event) => onStepMouseEnter(stepKey, event)}
            onMouseMove={onStepMouseMove}
            onMouseLeave={onStepMouseLeave}
        />
    )
}
