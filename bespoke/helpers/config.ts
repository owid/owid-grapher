/**
 * Parsers for the config a bespoke component is mounted with. ArchieML hands
 * every value over as a string, and readers author them by hand, so anything
 * malformed degrades to `undefined` (or `false`) instead of throwing — one bad
 * config value must not take the whole viz down.
 */

/** How the surrounding page embeds a bespoke component */
export interface EmbedConfig {
    urlSync: boolean
    hideMetadataModal: boolean
}

/** Props a variant component takes: its parsed config, embed flags included */
export interface VariantProps<Config> {
    config: Config & EmbedConfig
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

export function parseEmbedConfig(raw: Record<string, string>): EmbedConfig {
    return {
        urlSync: parseBoolean(raw.urlSync),
        hideMetadataModal: parseBoolean(raw.hideMetadataModal),
    }
}
