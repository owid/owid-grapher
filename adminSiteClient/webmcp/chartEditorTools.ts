/**
 * WebMCP tools for the chart editor (/admin/charts/create and
 * /admin/charts/:id/edit).
 *
 * This is the tool set that justifies WebMCP over an MCP server against the
 * admin API: it reads and changes the editor's live, unsaved state, which no
 * API can see. Every mutation goes through the same functions the editor's
 * buttons call (chartEditorActions.ts), the preview updates as it would for a
 * click, and nothing reaches the database until `save_chart`.
 *
 * Policy: tools never publish. `save_chart` creates or updates drafts only and
 * refuses on a published chart, because saving one changes the live site.
 */
import { runInAction } from "mobx"
import {
    ALL_GRAPHER_CHART_TYPES,
    DbChartTagJoin,
    DimensionProperty,
    EntityName,
    GrapherChartType,
} from "@ourworldindata/types"
import { excludeUndefined } from "@ourworldindata/utils"
import type { ChartEditor } from "../ChartEditor.js"
import type { EditorTab } from "../AbstractChartEditor.js"
import type {
    ErrorMessages,
    ErrorMessagesForDimensions,
} from "../ChartEditorTypes.js"
import {
    addChartType,
    findDimensionSlot,
    removeChartType,
    removeVariableFromSlot,
    saveChartTags,
    setSlotVariables,
} from "../chartEditorActions.js"
import { fetchIndicator, invalidateChartCache, parseId } from "./adminTools.js"
import { applyConfigPatch, validateConfigPatch } from "./configPatch.js"
import {
    alphanumericInsensitive,
    describeUnresolved,
    matchNames,
} from "./matching.js"
import { registerToolSet, toolResult, type WebMcpTool } from "./webmcpTypes.js"

export const CHART_EDITOR_TOOL_SET = "chart-editor"

const NOTHING_CHANGED = "Nothing was changed."
const LOADING = "The chart editor is still loading. Try again in a moment."

export interface ChartEditorToolContext {
    /** Resolved at call time: the editor is created after the page's data loads. */
    getEditor: () => ChartEditor | undefined
    getErrorMessages: () => ErrorMessages
    getErrorMessagesForDimensions: () => ErrorMessagesForDimensions
}

/** The same list the Save button is disabled on. */
export function editingErrors(context: ChartEditorToolContext): string[] {
    return excludeUndefined([
        ...Object.values(context.getErrorMessages()),
        ...Object.values(context.getErrorMessagesForDimensions()).flat(),
    ])
}

function describeIndicators(editor: ChartEditor): string {
    const { grapherState } = editor
    const lines = grapherState.dimensionSlots.flatMap((slot) =>
        slot.dimensions.map((dim) => {
            const name = dim.column?.displayName || dim.display?.name
            return `  ${slot.property}: ${dim.variableId}${name ? ` "${name}"` : ""}`
        })
    )
    const slots = grapherState.dimensionSlots
        .map(
            (slot) =>
                `${slot.property}${slot.allowMultiple ? " (several allowed)" : ""}`
        )
        .join(", ")
    return (
        (lines.length
            ? `Indicators:\n${lines.join("\n")}`
            : "Indicators: none") +
        `\nDimension slots for this chart type: ${slots}`
    )
}

function describeSelection(editor: ChartEditor): string {
    const names = editor.grapherState.selection.selectedEntityNames
    return names.length
        ? `Selected entities (${names.length}): ${names.join(", ")}`
        : "Selected entities: none"
}

function describeErrors(
    context: ChartEditorToolContext,
    editor: ChartEditor
): string {
    const errors = editingErrors(context)
    const parts: string[] = []
    if (editor.grapherState.hasFatalErrors)
        parts.push(
            "The chart cannot render (usually no indicator or no data yet)."
        )
    if (errors.length) parts.push(...errors.map((e) => `- ${e}`))
    return parts.length
        ? `Editing errors (saving is blocked until fixed):\n${parts.join("\n")}`
        : "Editing errors: none"
}

export function describeEditorState(
    context: ChartEditorToolContext,
    editor: ChartEditor
): string {
    const { grapherState } = editor
    const identity = editor.isNewGrapher
        ? "Chart: new, not saved yet"
        : `Chart #${grapherState.id} (version ${grapherState.version}), ${
              grapherState.isPublished
                  ? `published at /grapher/${grapherState.slug}`
                  : "draft"
          }`
    const title = grapherState.title
        ? `Title: ${grapherState.title}`
        : `Title: not set (would default to "${grapherState.effectiveTitle}")`
    const chartTypes = grapherState.chartTypes.length
        ? grapherState.chartTypes.join(", ")
        : "none"
    return [
        identity,
        title,
        grapherState.subtitle
            ? `Subtitle: ${grapherState.subtitle}`
            : "Subtitle: not set",
        `Chart types: ${chartTypes}; map tab: ${grapherState.hasMapTab ? "yes" : "no"}`,
        describeIndicators(editor),
        describeSelection(editor),
        grapherState.isReady
            ? `Data: loaded, ${grapherState.availableEntityNames.length} entities available`
            : "Data: not loaded yet",
        `Editor tab: ${editor.tab} (available: ${editor.availableTabs.join(", ")})`,
        `Unsaved changes: ${editor.isModified ? "yes" : "no"}`,
        describeErrors(context, editor),
    ].join("\n")
}

function withEditor(
    context: ChartEditorToolContext,
    fn: (editor: ChartEditor) => Promise<string> | string
): Promise<string> {
    return (async (): Promise<string> => {
        const editor = context.getEditor()
        if (!editor) return toolResult(LOADING)
        try {
            return toolResult(await fn(editor))
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return toolResult(`The action failed: ${message}`)
        }
    })()
}

/** Show the Basic tab: its default-entity reaction runs only while mounted. */
function showBasicTab(editor: ChartEditor): void {
    runInAction(() => {
        editor.tab = "basic"
        editor.showStaticPreview = false
    })
}

function resolveEntities(
    editor: ChartEditor,
    entities: unknown
): { ok: true; names: EntityName[] } | { ok: false; reason: string } {
    if (!Array.isArray(entities) || entities.some((e) => typeof e !== "string"))
        return { ok: false, reason: "entities must be an array of names." }
    const available = editor.grapherState.availableEntityNames
    if (available.length === 0)
        return {
            ok: false,
            reason: editor.grapherState.isReady
                ? "The chart's data has no entities."
                : "The chart's data is not loaded yet (add an indicator first, or wait a moment).",
        }
    const { resolved, unresolved } = matchNames(entities, available)
    if (unresolved.length)
        return {
            ok: false,
            reason: describeUnresolved(
                unresolved,
                "an entity in this chart's data"
            ),
        }
    return { ok: true, names: resolved }
}

function resolveChartType(
    chartType: unknown
): { ok: true; chartType: GrapherChartType } | { ok: false; reason: string } {
    if (typeof chartType !== "string")
        return { ok: false, reason: "chartType must be a string." }
    const { resolved, unresolved } = matchNames(
        [chartType],
        ALL_GRAPHER_CHART_TYPES,
        { normalize: alphanumericInsensitive }
    )
    if (unresolved.length)
        return {
            ok: false,
            reason:
                describeUnresolved(unresolved, "a chart type") +
                ` Valid chart types: ${ALL_GRAPHER_CHART_TYPES.join(", ")}.`,
        }
    return { ok: true, chartType: resolved[0] as GrapherChartType }
}

export function buildChartEditorTools(
    context: ChartEditorToolContext
): WebMcpTool[] {
    return [
        {
            name: "get_chart_editor_state",
            description:
                "Read the chart currently open in the editor: id, title, " +
                "chart types, indicators per dimension slot, selected " +
                "entities, whether data is loaded, unsaved changes and editing " +
                "errors. Call this before changing anything, and again after, " +
                "to confirm what the user now sees.",
            inputSchema: { type: "object", properties: {} },
            execute: () =>
                withEditor(context, (editor) =>
                    describeEditorState(context, editor)
                ),
        },
        {
            name: "add_indicators",
            description:
                "Add indicators (variables) to the chart by id, from " +
                "find_indicators. Existing indicators stay. The default slot " +
                "is the y axis; x, color and size exist on scatter plots. Only " +
                "the y slot of some chart types takes more than one indicator. " +
                "After adding, the editor picks default entities, which may " +
                "take a moment; check with get_chart_editor_state.",
            inputSchema: {
                type: "object",
                properties: {
                    variableIds: {
                        type: "array",
                        items: { type: "number" },
                        description: "Indicator ids from find_indicators",
                    },
                    slot: {
                        type: "string",
                        enum: ["y", "x", "color", "size"],
                        description: "Dimension slot, default y",
                    },
                },
                required: ["variableIds"],
            },
            execute: ({
                variableIds,
                slot = DimensionProperty.y,
            }: {
                variableIds: number[]
                slot?: string
            }) =>
                withEditor(context, async (editor) => {
                    const ids = Array.isArray(variableIds)
                        ? variableIds.map(parseId)
                        : []
                    if (ids.length === 0 || ids.some((id) => id === undefined))
                        return `variableIds must be a non-empty array of positive integers. ${NOTHING_CHANGED}`
                    const validIds = ids as number[]

                    const property = slot as DimensionProperty
                    const dimensionSlot = findDimensionSlot(editor, property)
                    if (!dimensionSlot)
                        return (
                            `"${slot}" is not a dimension slot of this chart type. Available slots: ` +
                            `${editor.grapherState.dimensionSlots.map((s) => s.property).join(", ")}. ${NOTHING_CHANGED}`
                        )

                    const existingIds = dimensionSlot.dimensions.map(
                        (d) => d.variableId
                    )
                    const newIds = validIds.filter(
                        (id) => !existingIds.includes(id)
                    )
                    if (newIds.length === 0)
                        return `All of these indicators are already in the ${property} slot. ${NOTHING_CHANGED}`
                    if (
                        !dimensionSlot.allowMultiple &&
                        existingIds.length + newIds.length > 1
                    )
                        return (
                            `The ${property} slot of this chart type holds a single indicator` +
                            (existingIds.length
                                ? ` and already has ${existingIds.join(", ")}; remove it first with remove_indicator.`
                                : ".") +
                            ` ${NOTHING_CHANGED}`
                        )

                    const details = await Promise.all(
                        newIds.map((id) =>
                            fetchIndicator(editor.manager.admin, id)
                        )
                    )
                    const missing = newIds.filter((_, i) => !details[i])
                    if (missing.length)
                        return `No indicator exists with id ${missing.join(", ")}. ${NOTHING_CHANGED}`

                    showBasicTab(editor)
                    await setSlotVariables(editor, property, [
                        ...existingIds,
                        ...newIds,
                    ])
                    const added = details
                        .map((d, i) => `${newIds[i]} "${d?.name ?? "unnamed"}"`)
                        .join(", ")
                    return (
                        `Added ${added} to the ${property} slot.\n${describeIndicators(editor)}\n` +
                        "Default entity selection may still be updating; call get_chart_editor_state to see it."
                    )
                }),
        },
        {
            name: "remove_indicator",
            description: "Remove an indicator from the chart by id.",
            inputSchema: {
                type: "object",
                properties: {
                    variableId: { type: "number" },
                },
                required: ["variableId"],
            },
            execute: ({ variableId }: { variableId: number }) =>
                withEditor(context, async (editor) => {
                    const id = parseId(variableId)
                    if (!id)
                        return `variableId must be a positive integer. ${NOTHING_CHANGED}`
                    const slot = editor.grapherState.dimensionSlots.find((s) =>
                        s.dimensions.some((d) => d.variableId === id)
                    )
                    if (!slot)
                        return `Indicator ${id} is not on this chart. ${describeIndicators(editor)} ${NOTHING_CHANGED}`
                    showBasicTab(editor)
                    await removeVariableFromSlot(editor, slot.property, id)
                    return `Removed indicator ${id} from the ${slot.property} slot.\n${describeIndicators(editor)}`
                }),
        },
        {
            name: "add_chart_type",
            description:
                "Enable a chart type (tab) on the chart. Compatible types are " +
                "added alongside the current ones (LineChart with SlopeChart; " +
                "the stacked types with each other); an incompatible type " +
                "replaces them. Use exact names: " +
                `${ALL_GRAPHER_CHART_TYPES.join(", ")}. The map tab is toggled ` +
                "with update_chart_config {hasMapTab: true/false}.",
            inputSchema: {
                type: "object",
                properties: {
                    chartType: {
                        type: "string",
                        enum: [...ALL_GRAPHER_CHART_TYPES],
                    },
                },
                required: ["chartType"],
            },
            execute: ({ chartType }: { chartType: string }) =>
                withEditor(context, async (editor) => {
                    const resolved = resolveChartType(chartType)
                    if (!resolved.ok)
                        return `${resolved.reason} ${NOTHING_CHANGED}`
                    const { grapherState } = editor
                    if (grapherState.validChartTypeSet.has(resolved.chartType))
                        return `${resolved.chartType} is already enabled. ${NOTHING_CHANGED}`
                    showBasicTab(editor)
                    await addChartType(editor, resolved.chartType)
                    return (
                        `Chart types are now: ${grapherState.chartTypes.join(", ")}.` +
                        (resolved.chartType === "ScatterPlot"
                            ? " Default x (GDP per capita), color (continent) and size (population) indicators were added."
                            : "") +
                        `\n${describeSelection(editor)}`
                    )
                }),
        },
        {
            name: "remove_chart_type",
            description:
                "Disable a chart type (tab) on the chart. A chart with no " +
                "chart types and a map tab is map-only.",
            inputSchema: {
                type: "object",
                properties: {
                    chartType: {
                        type: "string",
                        enum: [...ALL_GRAPHER_CHART_TYPES],
                    },
                },
                required: ["chartType"],
            },
            execute: ({ chartType }: { chartType: string }) =>
                withEditor(context, async (editor) => {
                    const resolved = resolveChartType(chartType)
                    if (!resolved.ok)
                        return `${resolved.reason} ${NOTHING_CHANGED}`
                    const { grapherState } = editor
                    if (!grapherState.chartTypes.includes(resolved.chartType))
                        return `${resolved.chartType} is not enabled on this chart. ${NOTHING_CHANGED}`
                    showBasicTab(editor)
                    await removeChartType(editor, resolved.chartType)
                    const types = grapherState.chartTypes
                    return `Chart types are now: ${types.length ? types.join(", ") : "none"}${
                        types.length === 0 && grapherState.hasMapTab
                            ? " (map only)"
                            : ""
                    }.`
                }),
        },
        {
            name: "select_entities",
            description:
                "Set which countries or regions the chart shows, replacing " +
                "the current selection. Names must be entities in the chart's " +
                "data; unknown names are refused with suggestions. To add " +
                "without removing, use add_entities.",
            inputSchema: {
                type: "object",
                properties: {
                    entities: {
                        type: "array",
                        items: { type: "string" },
                        description: "e.g. ['Czechia', 'Slovakia']",
                    },
                },
                required: ["entities"],
            },
            execute: ({ entities }: { entities: string[] }) =>
                withEditor(context, (editor) => {
                    const result = resolveEntities(editor, entities)
                    if (!result.ok) return `${result.reason} ${NOTHING_CHANGED}`
                    runInAction(() =>
                        editor.grapherState.selection.setSelectedEntities(
                            result.names
                        )
                    )
                    return describeSelection(editor)
                }),
        },
        {
            name: "add_entities",
            description:
                "Add countries or regions to the current selection without " +
                "removing any. Unknown names are refused with suggestions.",
            inputSchema: {
                type: "object",
                properties: {
                    entities: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
                required: ["entities"],
            },
            execute: ({ entities }: { entities: string[] }) =>
                withEditor(context, (editor) => {
                    const result = resolveEntities(editor, entities)
                    if (!result.ok) return `${result.reason} ${NOTHING_CHANGED}`
                    runInAction(() =>
                        editor.grapherState.selection.addToSelection(
                            result.names
                        )
                    )
                    return describeSelection(editor)
                }),
        },
        {
            name: "update_chart_config",
            description:
                "Change chart config fields by merging a partial grapher " +
                "config into the chart. Common fields: title, subtitle, note, " +
                "sourceDesc, variantName, internalNotes, hasMapTab, tab, " +
                "minTime, maxTime, hideRelativeToggle, stackMode, " +
                "yAxis {min, max, label, scaleType}, xAxis, map {region, " +
                "colorScale}, selectedEntityNames, hideLogo, " +
                "entityType, entityTypePlural, originUrl. Nested objects " +
                "merge, arrays replace, null removes a field. Not allowed: " +
                "id, version, isPublished, dimensions (use add_indicators). " +
                "The result lists any editing errors the change introduced.",
            inputSchema: {
                type: "object",
                properties: {
                    patch: {
                        type: "object",
                        description:
                            'Partial grapher config, e.g. {"title": "Life expectancy", "yAxis": {"min": 0}}',
                        additionalProperties: true,
                    },
                },
                required: ["patch"],
            },
            execute: ({ patch }: { patch: unknown }) =>
                withEditor(context, (editor) => {
                    const validation = validateConfigPatch(patch)
                    if (!validation.ok)
                        return `${validation.reason} ${NOTHING_CHANGED}`
                    applyConfigPatch(editor, validation.patch)
                    const keys = Object.keys(validation.patch).join(", ")
                    return `Updated ${keys}.\n${describeEditorState(context, editor)}`
                }),
        },
        {
            name: "set_chart_tags",
            description:
                "Set the chart's topic tags, replacing the current ones. Tag " +
                "names must match existing tags exactly (case-insensitive); " +
                "unknown names are refused with suggestions. Tags save " +
                "immediately and only work on a chart that has been saved.",
            inputSchema: {
                type: "object",
                properties: {
                    tagNames: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
                required: ["tagNames"],
            },
            execute: ({ tagNames }: { tagNames: string[] }) =>
                withEditor(context, async (editor) => {
                    if (editor.isNewGrapher)
                        return `Tags can only be set on a saved chart; call save_chart first. ${NOTHING_CHANGED}`
                    if (
                        !Array.isArray(tagNames) ||
                        tagNames.some((t) => typeof t !== "string")
                    )
                        return `tagNames must be an array of strings. ${NOTHING_CHANGED}`
                    const available = editor.availableTags
                    if (!available) return LOADING
                    const { resolved, unresolved } = matchNames(
                        tagNames,
                        available.map((t) => t.name)
                    )
                    if (unresolved.length)
                        return `${describeUnresolved(unresolved, "an existing tag")} ${NOTHING_CHANGED}`
                    const current = new Map(
                        (editor.tags ?? []).map((t) => [t.name, t])
                    )
                    const tags: DbChartTagJoin[] = resolved.map((name) => {
                        const existing = current.get(name)
                        if (existing) return existing
                        const tag = available.find((t) => t.name === name)!
                        return { id: tag.id, name: tag.name }
                    })
                    await saveChartTags(editor, tags)
                    return tags.length
                        ? `Tags are now: ${tags.map((t) => t.name).join(", ")}.`
                        : "All tags were removed."
                }),
        },
        {
            name: "switch_editor_tab",
            description:
                "Show a different tab of the editor's settings panel " +
                "(basic, data, text, customize, map, scatter, marimekko, " +
                "revisions, refs, export, debug). Only affects what the user " +
                "sees, not the chart.",
            inputSchema: {
                type: "object",
                properties: {
                    tab: { type: "string" },
                },
                required: ["tab"],
            },
            execute: ({ tab }: { tab: string }) =>
                withEditor(context, (editor) => {
                    const { resolved, unresolved } = matchNames(
                        [String(tab)],
                        editor.availableTabs
                    )
                    if (unresolved.length)
                        return (
                            `${describeUnresolved(unresolved, "an editor tab")} ` +
                            `Available: ${editor.availableTabs.join(", ")}. ${NOTHING_CHANGED}`
                        )
                    const next = resolved[0] as EditorTab
                    runInAction(() => {
                        editor.tab = next
                        editor.showStaticPreview = next === "export"
                    })
                    return `Showing the ${next} tab.`
                }),
        },
        {
            name: "save_chart",
            description:
                "Save the chart as a draft: creates it on first save, updates " +
                "it afterwards. Never publishes. Refused when the chart has " +
                "editing errors, and on published charts, since saving those " +
                "changes the live site; the user does that with the Update " +
                "button. After a first save the editor reloads at the new " +
                "chart's URL and these tools re-register.",
            inputSchema: { type: "object", properties: {} },
            execute: () =>
                withEditor(context, async (editor) => {
                    const { grapherState } = editor
                    if (grapherState.isPublished)
                        return (
                            `Chart #${grapherState.id} is published; saving would change the live chart. ` +
                            `Ask the user to review and click "Update chart". ${NOTHING_CHANGED}`
                        )
                    if (grapherState.hasFatalErrors)
                        return `The chart cannot render yet (no indicator or no data), so it cannot be saved. ${NOTHING_CHANGED}`
                    const errors = editingErrors(context)
                    if (errors.length)
                        return `Fix these editing errors first:\n${errors
                            .map((e) => `- ${e}`)
                            .join("\n")}\n${NOTHING_CHANGED}`
                    if (!editor.isNewGrapher && !editor.isModified)
                        return `There are no unsaved changes. ${NOTHING_CHANGED}`

                    const wasNew = editor.isNewGrapher
                    let failed = false
                    await editor.saveGrapher({
                        onError: () => {
                            failed = true
                        },
                    })
                    if (failed)
                        return "The server rejected the save; check the error shown in the admin."
                    invalidateChartCache()
                    const id = grapherState.id
                    if (wasNew)
                        return (
                            `Created draft chart #${id} ("${grapherState.effectiveTitle}"). ` +
                            `The editor is reloading at /admin/charts/${id}/edit; ` +
                            "wait a moment before calling editor tools again."
                        )
                    return `Saved draft chart #${id}, now version ${grapherState.version}.`
                }),
        },
    ]
}

export function registerChartEditorTools(
    context: ChartEditorToolContext,
    signal: AbortSignal
): Promise<void> {
    return registerToolSet(
        CHART_EDITOR_TOOL_SET,
        buildChartEditorTools(context),
        signal
    )
}
