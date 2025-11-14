import * as d3 from "d3"
import { COUNTRIES_WITH_DEFINITE_ARTICLE } from "./CausesOfDeathConstants.js"

export function formatNumberLongText(value: number): string {
    if (value === 0) return "0"

    if (value >= 1000000000) {
        const billions = value / 1000000000
        return `${billions.toFixed(1)} billion`
    } else if (value >= 1000000) {
        const millions = value / 1000000
        return `${millions.toFixed(1)} million`
    } else {
        return d3.format(",.0f")(value)
    }
}

export function formatSigFigNoAbbrev(value: number): string {
    if (value === 0) return "0"

    const significantDigits = 3
    const magnitude = Math.floor(Math.log10(Math.abs(value)))
    const factor = Math.pow(10, magnitude - (significantDigits - 1))
    const rounded = Math.round(value / factor) * factor

    return d3.format(",.0f")(rounded)
}

export function formatPercentSigFig(value: number): string {
    if (value === 0) return "0%"

    const percentage = value * 100
    const significantDigits = 2
    const magnitude = Math.floor(Math.log10(Math.abs(percentage)))
    const factor = Math.pow(10, magnitude - (significantDigits - 1))
    const rounded = Math.round(percentage / factor) * factor

    // Format with appropriate decimal places
    if (rounded >= 10) {
        return `${Math.round(rounded)}%`
    } else {
        return `${rounded.toFixed(1)}%`
    }
}

export function formatCountryName(countryName: string): string {
    if (COUNTRIES_WITH_DEFINITE_ARTICLE.includes(countryName)) {
        return `the ${countryName}`
    }
    return countryName
}

export const minBy = <T>(array: T[], selector: (item: T) => number): number => {
    return Math.min(...array.map(selector))
}

export const maxBy = <T>(array: T[], selector: (item: T) => number): number => {
    return Math.max(...array.map(selector))
}
