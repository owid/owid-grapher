/**
 * Parsers for the config a bespoke component is mounted with. ArchieML hands
 * every value over as a string, and readers author them by hand, so anything
 * malformed degrades to `undefined` (or `false`) instead of throwing — one bad
 * config value must not take the whole viz down.
 */

/** Props a variant component takes: its parsed config */
export interface VariantProps<Config> {
    config: Config
}

export function parseBoolean(value: unknown): boolean {
    return value === true || value === "true"
}

export function parseNumber(value: unknown): number | undefined {
    if (typeof value !== "string" && typeof value !== "number") return undefined
    const n = typeof value === "string" ? Number(value) : value
    return Number.isFinite(n) ? n : undefined
}

export function parseInteger(value: unknown): number | undefined {
    const n = parseNumber(value)
    return n === undefined ? undefined : Math.round(n)
}

/** `parseEnum(raw.flow, FLOWS)` — anything not in `allowed` reads as unset */
export function parseEnum<T extends string>(
    value: unknown,
    allowed: readonly T[]
): T | undefined {
    if (typeof value !== "string") return undefined
    return (allowed as readonly string[]).includes(value)
        ? (value as T)
        : undefined
}
