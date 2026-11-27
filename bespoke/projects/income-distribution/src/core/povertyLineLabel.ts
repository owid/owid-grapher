import { Bounds } from "@ourworldindata/utils"

import type { LabelBox } from "./curveLabels.js"

/** The poverty line's label metrics, in px (see PovertyLine in components/chart/PovertyLine.tsx) */
export const POVERTY_LINE_LABEL = {
    fontSize: 12,
    ballRadius: 5,
    gap: 6,
    clearSize: 14,
    lineHeight: 14,
} as const

export interface PovertyLineLabelLayout {
    /** Whether the label sits right of the ball (else left of it) */
    fitsRight: boolean
    /** Where the text is anchored: its start when right of the ball, its end when left */
    textX: number
    /** Left edge of the × */
    clearX: number
    clearCenterX: number
    /** Everything drawn at the top of the line: the ball, the text and the × */
    box: LabelBox
}

/**
 * Lays out the label at the top of the poverty line: the ball at (`x`,
 * `ballY`), then the bold first line (`title`, or `label` without one), the ×
 * when there is one, `label` below a title, and a lighter `hint` below that.
 * It goes right of the ball, or left of it when it would overflow `width` or
 * run into an obstacle; with `preferLeft`, left of the ball whenever it fits
 * there (the international line sits by the global peak, which its two-line
 * label would cover on the right). Shared by the line's drawing and the curve labels
 * that keep clear of it.
 */
export function layoutPovertyLineLabel({
    x,
    ballY,
    width,
    title,
    label,
    hint,
    hasClear,
    preferLeft = false,
    obstacles = [],
}: {
    x: number
    ballY: number
    width: number
    title?: string
    label: string
    hint?: string
    hasClear: boolean
    preferLeft?: boolean
    obstacles?: LabelBox[]
}): PovertyLineLabelLayout {
    const { fontSize, ballRadius, gap, clearSize, lineHeight } =
        POVERTY_LINE_LABEL
    const clearSpace = hasClear ? gap / 2 + clearSize : 0
    const titleWidth = Bounds.forText(title ?? label, {
        fontSize,
        fontWeight: 700,
    }).width
    const textWidth = Math.max(
        titleWidth,
        title ? Bounds.forText(label, { fontSize, fontWeight: 400 }).width : 0,
        hint
            ? Bounds.forText(hint, {
                  fontSize,
                  fontWeight: 400,
                  isItalic: true,
              }).width
            : 0
    )
    const extraLines = (title ? 1 : 0) + (hint ? 1 : 0)

    const top = ballY - clearSize / 2
    const bottom = ballY + clearSize / 2 + extraLines * lineHeight
    const rightStart = x + ballRadius + gap
    const rightEnd = rightStart + textWidth + clearSpace
    const leftEnd = x - ballRadius
    const leftStart = leftEnd - gap - clearSpace - textWidth
    const isClear = (start: number, end: number): boolean =>
        !obstacles.some(
            (box) =>
                box.left < end &&
                box.right > start &&
                box.top < bottom &&
                box.bottom > top
        )
    const roomRight = rightEnd <= width && isClear(rightStart, rightEnd)
    const roomLeft = leftStart >= 0 && isClear(leftStart, leftEnd)
    const fitsRight = preferLeft ? !roomLeft && roomRight : roomRight

    const textX = fitsRight ? rightStart : x - ballRadius - gap - clearSpace
    const clearX = fitsRight
        ? textX + titleWidth + gap / 2
        : x - ballRadius - gap - clearSize
    const box: LabelBox = fitsRight
        ? { left: x - ballRadius, right: rightEnd, top, bottom }
        : { left: textX - textWidth, right: x + ballRadius, top, bottom }
    return {
        fitsRight,
        textX,
        clearX,
        clearCenterX: clearX + clearSize / 2,
        box,
    }
}
