export type LabelSide = "left" | "right"

/** A label beside a bar on an axis */
export interface AxisLabel {
    /** Where the bar's left end sits, from 0 at the axis start to 1 at its end */
    barStart: number
    /** Where the bar's right end sits, on the same scale */
    barEnd: number
    /** Pixels the label takes up beside the bar */
    width: number
    /** Pixels it takes up with its unit on a second line; absent when the unit can't wrap */
    wrappedWidth?: number
    preferredSide: LabelSide
}

export interface FittedAxis {
    /** The axis length in pixels, starting where the available room starts */
    length: number
    /** The side each label ends up on, in the order given */
    sides: LabelSide[]
    /** Whether each label puts its unit on a second line, in the order given */
    isWrapped: boolean[]
}

/**
 * The longest axis that keeps every label within `availableLength` pixels.
 * Right labels shorten the axis until they fit; a left label with no room
 * before the axis start wraps its unit if that makes it fit, and moves to its
 * bar's right otherwise.
 */
export function fitAxisToLabels(
    labels: AxisLabel[],
    availableLength: number,
    /** Room kept free past the axis end */
    endMargin: number
): FittedAxis {
    const sides = labels.map((label) => label.preferredSide)
    const isWrapped = labels.map(() => false)

    // Moving a label right can only shorten the axis, which can only push
    // more left labels out, so this settles after at most one pass per label
    for (;;) {
        const length = measureLongestAxis(
            labels,
            sides,
            availableLength,
            endMargin
        )
        const crampedIndices: number[] = []
        labels.forEach((label, index) => {
            isWrapped[index] = false
            if (sides[index] !== "left") return
            const room = label.barStart * length
            if (label.width <= room) return
            if (label.wrappedWidth !== undefined && label.wrappedWidth <= room)
                isWrapped[index] = true
            else crampedIndices.push(index)
        })
        if (crampedIndices.length === 0) return { length, sides, isWrapped }
        for (const index of crampedIndices) sides[index] = "right"
    }
}

function measureLongestAxis(
    labels: AxisLabel[],
    sides: LabelSide[],
    availableLength: number,
    endMargin: number
): number {
    let length = availableLength - endMargin
    labels.forEach((label, index) => {
        if (sides[index] !== "right" || label.barEnd <= 0) return
        length = Math.min(
            length,
            (availableLength - label.width) / label.barEnd
        )
    })
    return Math.max(0, length)
}
