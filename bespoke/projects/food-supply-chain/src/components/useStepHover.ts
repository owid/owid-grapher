import { useCallback, useRef, useState } from "react"

import { getRelativeMouse, isTouchDevice, Point } from "@ourworldindata/utils"

import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import { StageKey } from "../core/types.js"

/** The hovered or touch-pinned step, at the mouse position that triggered it */
export interface StepHover {
    stepKey: StageKey
    position: Point
}

export function useStepHover(): {
    svgRef: React.RefObject<SVGSVGElement | null>
    containerRef: React.RefObject<HTMLDivElement | null>
    hover: StepHover | undefined
    isPinned: boolean
    onStepMouseEnter: (stepKey: StageKey, event: React.MouseEvent) => void
    onStepMouseMove: (event: React.MouseEvent) => void
    onStepMouseLeave: () => void
} {
    const svgRef = useRef<SVGSVGElement>(null)
    const [hover, setHover] = useState<StepHover | undefined>(undefined)

    const dismissHover = useCallback(() => setHover(undefined), [])
    const { ref: containerRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        hover !== undefined,
        dismissHover
    )

    const onStepMouseEnter = useCallback(
        (stepKey: StageKey, event: React.MouseEvent) => {
            if (!svgRef.current) return
            const position = getRelativeMouse(svgRef.current, event.nativeEvent)
            setHover({ stepKey, position })
        },
        []
    )
    const onStepMouseMove = useCallback((event: React.MouseEvent) => {
        if (!svgRef.current) return
        const position = getRelativeMouse(svgRef.current, event.nativeEvent)
        setHover((prev) => (prev ? { ...prev, position } : prev))
    }, [])
    const onStepMouseLeave = useCallback(() => {
        // usePinnedTooltip owns dismissal on touch
        if (isTouchDevice()) return
        setHover(undefined)
    }, [])

    return {
        svgRef,
        containerRef,
        hover,
        isPinned,
        onStepMouseEnter,
        onStepMouseMove,
        onStepMouseLeave,
    }
}
