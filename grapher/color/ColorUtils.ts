import { rgb } from "d3-color"
import { interpolate } from "d3-interpolate"

export const interpolateArray = (scaleArr: string[]) => {
    const N = scaleArr.length - 2 // -1 for spacings, -1 for number of interpolate fns
    const intervalWidth = 1 / N
    const intervals: Array<(t: number) => string> = []

    for (let i = 0; i <= N; i++) {
        intervals[i] = interpolate(rgb(scaleArr[i]), rgb(scaleArr[i + 1]))
    }

    return (t: number) => {
        if (t < 0 || t > 1)
            throw new Error("Outside the allowed range of [0, 1]")

        const i = Math.floor(t * N)
        const intervalOffset = i * intervalWidth

        return intervals[i](t / intervalWidth - intervalOffset / intervalWidth)
    }
}
