/**
 * Horizontal reference lines: training compute thresholds written into law.
 */

// Only legal thresholds for now; human comparisons may come back as a kind
export type ReferencePointKind = "threshold"

export interface ReferencePoint {
    id: string
    label: string
    /** Used when the chart is narrow */
    shortLabel: string
    /** Longer explanation for the tooltip */
    description: string
    flop: number
    kind: ReferencePointKind
}

export const REFERENCE_POINTS: ReferencePoint[] = [
    {
        id: "eu-ai-act",
        label: "EU AI Act systemic risk threshold",
        shortLabel: "EU AI Act",
        description:
            "Under the EU AI Act, general-purpose AI models trained with more than 10²⁵ FLOP are presumed to pose systemic risk and face extra obligations.",
        flop: 1e25,
        kind: "threshold",
    },
    {
        id: "california-sb53",
        label: "California SB 53 frontier model threshold",
        shortLabel: "California SB 53",
        description:
            "California's Transparency in Frontier AI Act (SB 53, 2025) applies to models trained with more than 10²⁶ FLOP, the same threshold the 2023 US executive order on AI used for reporting.",
        flop: 1e26,
        kind: "threshold",
    },
]
