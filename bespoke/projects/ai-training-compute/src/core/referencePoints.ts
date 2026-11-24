import { SECONDS_PER_MONTH } from "./constants.js"

/**
 * Horizontal reference lines. Human comparisons use the same one-month
 * period as the computers in computers.ts; regulatory thresholds are totals
 * written into law.
 */

export type ReferencePointKind = "human" | "threshold"

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
        id: "person-month",
        label: "A person doing one calculation per second for a month",
        shortLabel: "1 person, 1 calc/second, 1 month",
        description:
            "One arithmetic operation every second, without sleeping, for 30 days.",
        flop: SECONDS_PER_MONTH, // ≈ 2.6 × 10⁶
        kind: "human",
    },
    {
        id: "everyone-month",
        label: "Everyone on Earth doing one calculation per second for a month",
        shortLabel: "All humans, 1 calc/second, 1 month",
        description:
            "8.2 billion people each doing one arithmetic operation every second for 30 days.",
        flop: 8.2e9 * SECONDS_PER_MONTH, // ≈ 2.1 × 10¹⁶
        kind: "human",
    },
    {
        id: "brain-month",
        label: "A human brain for a month (rough estimate)",
        shortLabel: "Human brain, 1 month (est.)",
        description:
            "Estimates of the brain's computation vary by orders of magnitude; a commonly cited central estimate is about 10¹⁵ operations per second (Carlsmith, 2020). Over 30 days that is about 2.6 × 10²¹.",
        flop: 1e15 * SECONDS_PER_MONTH, // ≈ 2.6 × 10²¹
        kind: "human",
    },
    {
        id: "eu-ai-act",
        label: "EU AI Act: presumed “systemic risk” above this",
        shortLabel: "EU AI Act threshold",
        description:
            "Under the EU AI Act, general-purpose AI models trained with more than 10²⁵ FLOP are presumed to pose systemic risk and face extra obligations.",
        flop: 1e25,
        kind: "threshold",
    },
    {
        id: "california-sb53",
        label: "California SB 53: “frontier model” above this",
        shortLabel: "California SB 53 threshold",
        description:
            "California's Transparency in Frontier AI Act (SB 53, 2025) applies to models trained with more than 10²⁶ FLOP, the same threshold the 2023 US executive order on AI used for reporting.",
        flop: 1e26,
        kind: "threshold",
    },
]
