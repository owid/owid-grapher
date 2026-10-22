import type {
    BespokeAuthoredConfig,
    BespokeConfigSpec,
} from "./bespokeComponentTypes.ts"

/** Authored flags every bespoke component accepts, next to its own config */
export interface EmbedConfig {
    urlSync: boolean
}

export const EMBED_CONFIG_SPEC = {
    urlSync: {
        type: "boolean",
        default: "false",
        description: "Sync the viz state with the page URL",
    },
} as const satisfies BespokeConfigSpec

/** Set in code by the page embedding a bespoke component, never authored */
export interface EmbedOptions {
    hideMetadataModal?: boolean
}

/** Turn embed flags into the string config ArchieML would have carried */
export function serializeEmbedConfig(
    flags: Partial<EmbedConfig>
): BespokeAuthoredConfig {
    return Object.fromEntries(
        Object.entries(flags).map(([key, value]) => [key, String(value)])
    )
}
