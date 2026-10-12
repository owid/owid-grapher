import type {
    BespokeAuthoredConfig,
    BespokeConfigSpec,
} from "./bespokeComponentTypes.ts"

/** How the surrounding page embeds a bespoke component */
export interface EmbedConfig {
    urlSync: boolean
    hideMetadataModal: boolean
}

export const EMBED_CONFIG_SPEC = {
    urlSync: {
        type: "boolean",
        default: "false",
        description: "Sync the viz state with the page URL",
    },
    hideMetadataModal: {
        type: "boolean",
        default: "false",
        description: "Hide the metadata modal",
    },
} as const satisfies BespokeConfigSpec

/** Turn embed flags into the string config ArchieML would have carried */
export function serializeEmbedConfig(
    flags: Partial<EmbedConfig>
): BespokeAuthoredConfig {
    return Object.fromEntries(
        Object.entries(flags).map(([key, value]) => [key, String(value)])
    )
}
