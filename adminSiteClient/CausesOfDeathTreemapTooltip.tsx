import { TooltipState } from "./CausesOfDeathConstants.js"
import * as d3 from "d3"
import { useRef, useEffect, useState } from "react"

export function CausesOfDeathTreemapTooltip({
    state,
    containerWidth,
    containerHeight,
    offsetX = 0,
    offsetY = 0,
}: {
    state: TooltipState
    containerWidth: number
    containerHeight: number
    offsetX?: number
    offsetY?: number
}) {
    const { target, position } = state
    const tooltipRef = useRef<HTMLDivElement>(null)
    const [adjustedPosition, setAdjustedPosition] = useState(position)

    // Position tooltip using sophisticated logic inspired by Grapher tooltips
    useEffect(() => {
        if (!tooltipRef.current) return

        const tooltip = tooltipRef.current
        const rect = tooltip.getBoundingClientRect()

        const bounds = {
            width: rect.width,
            height: rect.height,
        }

        let left = position.x + offsetX
        let top = position.y + offsetY

        // Apply the sophisticated positioning logic from Grapher tooltips
        if (bounds) {
            // Flip left if tooltip would overflow right edge
            if (left + bounds.width > containerWidth) {
                left -= bounds.width + 2 * offsetX // flip left
            }

            // Flip upward if tooltip would overflow bottom edge (with 75% threshold)
            if (top + bounds.height * 0.75 > containerHeight) {
                top -= bounds.height + 2 * offsetY // flip upwards eventually...
            }

            // Pin at bottom if still overflowing
            if (top + bounds.height > containerHeight) {
                top = containerHeight - bounds.height // ...but first pin at bottom
            }

            // Pin at edges if going off-screen
            if (left < 0) left = 0 // pin on left
            if (top < 0) top = 0 // pin at top
        }

        setAdjustedPosition({ x: left, y: top })
    }, [position, target, containerWidth, containerHeight, offsetX, offsetY])

    if (!target) return null

    const node = target.node
    const variable = node.data.data.variable
    const value = node.value || 0
    const category = node.data.data.category

    return (
        <div
            ref={tooltipRef}
            className="causes-of-death-tooltip"
            style={{
                position: "absolute",
                left: adjustedPosition.x,
                top: adjustedPosition.y,
                backgroundColor: "rgba(0, 0, 0, 0.9)",
                color: "white",
                padding: "8px 12px",
                borderRadius: "4px",
                fontSize: "12px",
                pointerEvents: "none",
                zIndex: 1000,
                maxWidth: "200px",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                transform: "translateZ(0)", // Force GPU acceleration for smoother positioning
            }}
        >
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                {variable}
            </div>
            {category && (
                <div
                    style={{
                        fontSize: "10px",
                        opacity: 0.8,
                        marginBottom: "4px",
                    }}
                >
                    {category}
                </div>
            )}
            <div style={{ fontSize: "11px" }}>
                Deaths: {d3.format(",~")(value)}
            </div>
        </div>
    )
}
