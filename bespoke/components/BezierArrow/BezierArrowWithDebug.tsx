import { useState } from "react"
import { BezierArrow, type BezierArrowProps } from "@ourworldindata/grapher"
import { type Point } from "@ourworldindata/utils"
import { DraggableDebugHandles } from "./DraggableDebugHandles"

/**
 * Wraps with draggable handles for interactively designing bezier curves.
 * When you drag, the final offsets are logged to the console so you can paste
 * them back as props.
 */
export function BezierArrowWithDebug(
    props: BezierArrowProps
): React.ReactElement {
    const [offsets, setOffsets] = useState<{
        start: Point
        end: Point
    } | null>(null)

    const startHandleOffset = offsets?.start ??
        props.startHandleOffset ?? { x: 0, y: 0 }
    const endHandleOffset = offsets?.end ??
        props.endHandleOffset ?? { x: 0, y: 0 }

    return (
        <>
            <BezierArrow
                {...props}
                startHandleOffset={startHandleOffset}
                endHandleOffset={endHandleOffset}
            />
            <DraggableDebugHandles
                start={props.start}
                end={props.end}
                startHandleOffset={startHandleOffset}
                endHandleOffset={endHandleOffset}
                startHandle={props.startHandle}
                endHandle={props.endHandle}
                onOffsetsChange={setOffsets}
            />
        </>
    )
}
