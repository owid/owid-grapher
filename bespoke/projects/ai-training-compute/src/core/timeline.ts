/**
 * Context drawn along the time axis. Doubling times are from Sevilla et al.
 * (2022), "Compute Trends Across Three Eras of Machine Learning".
 */

export interface Era {
    label: string
    detail: string
    start: number
    end: number
}

export const ERAS: Era[] = [
    {
        label: "Pre-deep-learning era",
        detail: "Training computation doubled about every 20 months",
        start: 1952,
        end: 2010,
    },
    {
        label: "Deep learning era",
        detail: "Doubling about every 6 months",
        start: 2010,
        end: Infinity,
    },
]

export interface TimelineEvent {
    year: number
    label: string
}

export const TIMELINE_EVENTS: TimelineEvent[] = [
    {
        year: 1956.6,
        label: "1956: Dartmouth workshop, often seen as the start of AI research",
    },
    {
        year: 1997.35,
        label: "1997: Deep Blue beats chess champion Garry Kasparov",
    },
    { year: 2022.9, label: "2022: ChatGPT launches" },
]

export interface TimePreset {
    label: string
    range: [number, number]
}

export function getTimePresets(lastYear: number): TimePreset[] {
    return [
        { label: "All", range: [1940, lastYear] },
        { label: "1950–2010", range: [1950, 2010] },
        { label: "Since 2010", range: [2010, lastYear] },
        { label: "Since 2020", range: [2020, lastYear] },
    ]
}
