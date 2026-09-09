/**
 * Validation and application of a partial grapher config coming from an agent.
 *
 * The chart editor's `updateLiveGrapher` resets the state before applying a
 * config, so the patch is merged onto the live config first. The merge is the
 * plain array-replacing one from utils, not `mergeGrapherConfigs`, which
 * strips identity keys (id, slug, version, isPublished) from every layer but
 * the last and would turn a saved chart into a new one.
 */
import { GrapherInterface, grapherKeysToSerialize } from "@ourworldindata/types"
import { merge } from "@ourworldindata/utils"
import type { AbstractChartEditor } from "../AbstractChartEditor.js"

/** Keys with a dedicated tool or that the agent must not touch at all. */
export const CONFIG_PATCH_DENYLIST: Record<string, string> = {
    id: "the chart id is assigned on save",
    version: "the version is managed on save",
    $schema: "the schema version is managed by the editor",
    isPublished: "publishing is a human decision; leave the chart a draft",
    dimensions: "use add_indicators / remove_indicator to change indicators",
}

export type ConfigPatchValidation =
    | { ok: true; patch: Partial<GrapherInterface> }
    | { ok: false; reason: string }

export function validateConfigPatch(input: unknown): ConfigPatchValidation {
    if (typeof input !== "object" || input === null || Array.isArray(input))
        return { ok: false, reason: "patch must be a JSON object." }

    const keys = Object.keys(input)
    if (keys.length === 0)
        return { ok: false, reason: "patch is empty; nothing to apply." }

    const denied = keys.filter((key) => key in CONFIG_PATCH_DENYLIST)
    if (denied.length)
        return {
            ok: false,
            reason: denied
                .map(
                    (key) =>
                        `"${key}" cannot be set: ${CONFIG_PATCH_DENYLIST[key]}.`
                )
                .join(" "),
        }

    const known = new Set<string>(grapherKeysToSerialize)
    const unknown = keys.filter((key) => !known.has(key))
    if (unknown.length)
        return {
            ok: false,
            reason:
                `Unknown config field(s): ${unknown.map((k) => `"${k}"`).join(", ")}. ` +
                `Valid top-level fields: ${grapherKeysToSerialize
                    .filter((k) => !(k in CONFIG_PATCH_DENYLIST))
                    .join(", ")}.`,
        }

    return { ok: true, patch: input }
}

/**
 * Merge the patch onto the live config. Objects merge recursively, arrays
 * replace, and a top-level `null` removes the field.
 */
export function mergeConfigPatch(
    liveConfig: GrapherInterface,
    patch: Partial<GrapherInterface>
): GrapherInterface {
    const merged = merge(liveConfig, patch) as Record<string, unknown>
    for (const [key, value] of Object.entries(patch)) {
        if (value === null) delete merged[key]
    }
    return merged
}

export function applyConfigPatch(
    editor: AbstractChartEditor,
    patch: Partial<GrapherInterface>
): void {
    editor.updateLiveGrapher(mergeConfigPatch(editor.liveConfig, patch))
}
