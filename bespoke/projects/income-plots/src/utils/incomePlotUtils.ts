import { roundSigFig } from "@ourworldindata/utils"
import * as fastKde from "fast-kde"
import type * as Plot from "@observablehq/plot"
import { useEffect } from "react"

export function formatCurrency(num: number) {
    if (num >= 10) return "$" + roundSigFig(num, 2)
    if (num >= 1) return "$" + (Math.round(num * 10) / 10).toFixed(2)
    else return "$" + num.toFixed(2)
}

const BANDWIDTH = 0.15
const EXTENT = [0.25, 1000].map(Math.log2)

export function kdeLog(pointsLog2: number[]) {
    const k = fastKde.density1d(pointsLog2, {
        bandwidth: BANDWIDTH,
        extent: EXTENT,
    })
    return [...k.points()].map((p) => ({
        ...p,
        x: Math.pow(2, p.x),
    })) as Array<{ x: number; y: number }>
}

export const usePlot = (
    plot: ReturnType<typeof Plot.plot>,
    containerRef: React.RefObject<HTMLElement | null>
) => {
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        container.appendChild(plot)

        // Cleanup when unmounted
        return () => plot.remove()
    }, [plot, containerRef])
}

// copied from CustomSchemes.ts
const OwidDistinctColors = {
    Purple: "#6d3e91",
    DarkOrange: "#c05917",
    LightTeal: "#58ac8c",
    Blue: "#286bbb",
    Maroon: "#883039",
    Camel: "#bc8e5a",
    MidnightBlue: "#00295b",
    DustyCoral: "#c15065",
    DarkOliveGreen: "#18470f",
    DarkCopper: "#9a5129",
    Peach: "#e56e5a",
    Mauve: "#a2559c",
    Turquoise: "#38aaba",
    OliveGreen: "#578145",
    Cherry: "#970046",
    Teal: "#00847e",
    RustyOrange: "#b13507",
    Denim: "#4c6a9c",
    Fuchsia: "#cf0a66",
    TealishGreen: "#00875e",
    Copper: "#b16214",
    DarkMauve: "#8c4569",
    Lime: "#3b8e1d",
    Coral: "#d73c50",
} as const

export const REGION_COLORS = {
    "East Asia and Pacific": OwidDistinctColors.Turquoise,
    "Europe and Central Asia": OwidDistinctColors.Denim,
    "Latin America and Caribbean": OwidDistinctColors.DustyCoral,
    "Middle East, North Africa, Afghanistan and Pakistan":
        OwidDistinctColors.Camel,
    "North America": OwidDistinctColors.Peach,
    "South Asia": OwidDistinctColors.TealishGreen,
    "Sub-Saharan Africa": OwidDistinctColors.Mauve,
}
