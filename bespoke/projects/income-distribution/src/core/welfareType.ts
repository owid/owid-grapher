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

/** What a country's household surveys measure, for the reader */
export const WELFARE_TYPE_LABELS: Record<WelfareType, string> = {
    income: "Income data",
    consumption: "Consumption data",
}
