import type { Breakpoint } from "./useBreakpoint"

export interface FontTier {
    tick: number
    label: number
    header: number
    annotation: number
    symbol: number
}

const FONT_TIERS: Record<Breakpoint, FontTier> = {
    large: {
        tick: 11,
        label: 9,
        header: 10,
        annotation: 10,
        symbol: 7,
    },
    medium: {
        tick: 9,
        label: 8,
        header: 9,
        annotation: 9,
        symbol: 6,
    },
    small: {
        tick: 8,
        label: 7,
        header: 8,
        annotation: 8,
        symbol: 6,
    },
}

export function getFontTier(breakpoint: Breakpoint): FontTier {
    return FONT_TIERS[breakpoint]
}

interface Margin {
    top: number
    right: number
    bottom: number
    left: number
}

export interface SizeTier {
    pyramidMargin: Margin
    pyramidCenterGap: number
    pyramidTriangle: { w: number; h: number }
    chartMargin: Margin
}

const SIZE_TIERS: Record<Breakpoint, SizeTier> = {
    large: {
        pyramidMargin: { top: 16, right: 4, bottom: 14, left: 4 },
        pyramidCenterGap: 40,
        pyramidTriangle: { w: 4, h: 3 },
        chartMargin: { top: 0, right: 0, bottom: 12, left: 0 },
    },
    medium: {
        pyramidMargin: { top: 16, right: 3, bottom: 14, left: 3 },
        pyramidCenterGap: 32,
        pyramidTriangle: { w: 3.5, h: 2.5 },
        chartMargin: { top: 0, right: 0, bottom: 10, left: 0 },
    },
    small: {
        pyramidMargin: { top: 16, right: 3, bottom: 14, left: 3 },
        pyramidCenterGap: 32,
        pyramidTriangle: { w: 3.5, h: 2.5 },
        chartMargin: { top: 0, right: 0, bottom: 10, left: 0 },
    },
}

export function getSizeTier(breakpoint: Breakpoint): SizeTier {
    return SIZE_TIERS[breakpoint]
}
