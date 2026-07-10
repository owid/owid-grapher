import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TooltipValue } from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"
import { TooltipFooterIcon } from "@ourworldindata/grapher/src/tooltip/TooltipProps.js"
import { GrapherTooltipAnchor } from "@ourworldindata/utils"

export interface ProjectionsTooltipRow {
    key: string
    label: string
    value: string
    color?: string
}

export function ProjectionsTooltip({
    title,
    subtitle,
    rows,
    isProjected,
    position,
    pinToBottom,
    containerWidth,
    containerHeight,
}: {
    title: string
    subtitle?: string
    rows: ProjectionsTooltipRow[]
    /** Whether the hovered year is in the projected period */
    isProjected: boolean
    position: { x: number; y: number }
    pinToBottom: boolean
    containerWidth: number
    containerHeight: number
}) {
    return (
        <TooltipCard
            id="poverty-projections-tooltip"
            x={position.x}
            y={position.y}
            offsetX={16}
            offsetY={-8}
            title={title}
            subtitle={subtitle}
            footer={
                isProjected
                    ? [
                          {
                              icon: TooltipFooterIcon.Stripes,
                              text: "Projected data",
                          },
                      ]
                    : undefined
            }
            anchor={pinToBottom ? GrapherTooltipAnchor.Bottom : undefined}
            containerBounds={
                pinToBottom
                    ? undefined
                    : { width: containerWidth, height: containerHeight }
            }
        >
            {rows.map((row) => (
                <TooltipValue
                    key={row.key}
                    label={row.label}
                    value={row.value}
                    color={row.color}
                    isProjection={isProjected}
                />
            ))}
        </TooltipCard>
    )
}
