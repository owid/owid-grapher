import type { BespokeAuthoredConfig } from "./bespokeComponentTypes.ts"

/** How the surrounding page embeds a bespoke component */
export interface EmbedConfig {
    urlSync: boolean
    hideMetadataModal: boolean
}

/** Turn embed flags into the string config ArchieML would have carried */
export function serializeEmbedConfig(
    flags: Partial<EmbedConfig>
): BespokeAuthoredConfig {
    return Object.fromEntries(
        Object.entries(flags).map(([key, value]) => [key, String(value)])
    )
}
