import { WELFARE_TYPES, type WelfareType } from "./types.js"

/**
 * PLACEHOLDER until the feed carries PIP's `welfare_type` for each country:
 * picks income or consumption pseudo-randomly from a hash of the country's
 * name, so a country keeps its value across renders and sessions. Replace
 * with the feed's value; nothing here reflects the real data.
 */
export function placeholderWelfareType(countryName: string): WelfareType {
    // 32-bit FNV-1a
    let hash = 0x811c9dc5
    for (let i = 0; i < countryName.length; i++) {
        hash ^= countryName.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }
    // The top bit: FNV-1a's lowest bits mix poorly
    return WELFARE_TYPES[hash >>> 31]
}

/** The badge next to a country's name, and its explanation */
export const WELFARE_TYPE_BADGES: Record<
    WelfareType,
    { letter: string; title: string; description: string }
> = {
    income: {
        letter: "I",
        title: "Income data",
        description:
            "This country's household surveys measure income: what people earn, after taxes and benefits, per person. Income data tends to show more inequality than consumption data.",
    },
    consumption: {
        letter: "C",
        title: "Consumption data",
        description:
            "This country's household surveys measure consumption: what people spend on goods and services, per person. Consumption data tends to show less inequality than income data.",
    },
}
