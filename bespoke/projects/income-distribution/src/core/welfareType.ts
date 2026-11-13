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

/**
 * What a country's household surveys measure, for the reader: the phrase a
 * sentence uses for it (`term`), and the details-on-demand card behind that
 * phrase and behind the picker's label (`title`, `description`)
 */
export const WELFARE_TYPE_DETAILS: Record<
    WelfareType,
    { term: string; title: string; description: string }
> = {
    income: {
        term: "income after taxes and benefits",
        title: "Income data",
        description:
            "What people earn, after taxes and benefits, per person. Income data tends to show more inequality than consumption data.",
    },
    consumption: {
        term: "consumption",
        title: "Consumption data",
        description:
            "What people spend on goods and services, per person. Consumption data tends to show less inequality than income data.",
    },
}
