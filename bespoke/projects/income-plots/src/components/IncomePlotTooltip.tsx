import {
    FloatingPortal,
    arrow,
    autoUpdate,
    flip,
    offset,
    shift,
    useClientPoint,
    useFloating,
    useHover,
    useInteractions,
} from "@floating-ui/react"
import { useAtomValue } from "jotai"
import { useRef } from "react"
import { atomHoveredEntity, atomTooltipIsOpen } from "../store.ts"

export const IncomePlotTooltip = () => {
    const arrowRef = useRef(null)

    const isOpen = useAtomValue(atomTooltipIsOpen)
    const hoveredEntity = useAtomValue(atomHoveredEntity)

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        middleware: [offset(10), flip(), shift(), arrow({ element: arrowRef })],
        placement: "right",
        whileElementsMounted: autoUpdate,
    })

    const hover = useHover(context, { move: false })
    const clientPoint = useClientPoint(context)
    const { getFloatingProps } = useInteractions([hover, clientPoint])

    return (
        <>
            {isOpen && (
                <FloatingPortal>
                    <div
                        className="income-plot-tooltip"
                        ref={refs.setFloating}
                        style={floatingStyles}
                        {...getFloatingProps()}
                    >
                        <div className="tooltip--entityName">
                            {hoveredEntity}
                        </div>
                        <div className="tooltip--percentage">
                            {/* Placeholder for: % if population below */}
                        </div>
                        <div className="tooltip--set-pov-line">
                            Click to set poverty line
                        </div>
                    </div>
                </FloatingPortal>
            )}
        </>
    )
}
