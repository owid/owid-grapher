import { useCallback, useEffect, useRef, useState } from "react"
import cx from "clsx"

import {
    shortenWithEllipsis,
    TextWrap,
} from "@ourworldindata/components/src/TextWrap/TextWrap.js"
import { getRelativeMouse, isTouchDevice, Point } from "@ourworldindata/utils"

import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import { CONNECTOR_WIDTH } from "../core/constants.js"
import { StageKey } from "../core/types.js"
import { PlacedLine } from "../core/waterfallLayout.js"

export function FoodSupplyChainConnector({
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

/** A TextWrap cut to at most `maxLines` lines, with an ellipsis on the last one if anything was cut */
export function buildTruncatedTextWrap({
    text,
    maxWidth,
    maxLines,
    fontSize,
    fontWeight,
}: {
    text: string
    maxWidth: number
    maxLines: number
    fontSize: number
    fontWeight: number
}): TextWrap {
    const wrap = new TextWrap({ text, maxWidth, fontSize, fontWeight })
    if (wrap.lines.length <= maxLines) return wrap

    const kept = wrap.lines.slice(0, maxLines).map((line) => line.text)
    kept[kept.length - 1] = shortenWithEllipsis(
        kept[kept.length - 1],
        maxWidth,
        { fontSize, fontWeight }
    )
    return new TextWrap({
        text: kept.join("\n"),
        maxWidth,
        fontSize,
        fontWeight,
    })
}

const HOVER_CLEAR_DELAY_MS = 150

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
    const clearTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
    const cancelPendingClear = useCallback(() => {
        clearTimeout(clearTimeoutRef.current)
        clearTimeoutRef.current = undefined
    }, [])
    useEffect(() => cancelPendingClear, [cancelPendingClear])

    const dismissHover = useCallback(() => setHover(undefined), [])
    const { ref: containerRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        hover !== undefined,
        dismissHover
    )

    const onStepMouseEnter = useCallback(
        (stepKey: StageKey, event: React.MouseEvent) => {
            if (!svgRef.current) return
            cancelPendingClear()
            const position = getRelativeMouse(svgRef.current, event.nativeEvent)
            setHover({ stepKey, position })
        },
        [cancelPendingClear]
    )
    const onStepMouseMove = useCallback((event: React.MouseEvent) => {
        if (!svgRef.current) return
        const position = getRelativeMouse(svgRef.current, event.nativeEvent)
        setHover((prev) => (prev ? { ...prev, position } : prev))
    }, [])
    const onStepMouseLeave = useCallback(() => {
        if (isTouchDevice()) return
        cancelPendingClear()
        clearTimeoutRef.current = setTimeout(
            () => setHover(undefined),
            HOVER_CLEAR_DELAY_MS
        )
    }, [cancelPendingClear])

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
