/**
 * Editor actions that both the editor UI (EditorBasicTab) and the WebMCP
 * editor tools call, so an agent's "add this indicator" does exactly what the
 * "Add indicator" button does.
 *
 * They're module functions taking the editor rather than methods on it:
 * the components are generic over `Editor extends AbstractChartEditor`, a few
 * actions need the concrete `ChartEditor`, and the bodies pull in editor-domain
 * constants that don't belong in the store.
 */
import { runInAction } from "mobx"
import {
    DbChartTagJoin,
    DimensionProperty,
    GRAPHER_CHART_TYPES,
    GrapherChartType,
    OwidChartDimensionInterface,
    OwidVariableId,
    ScaleType,
    StackMode,
} from "@ourworldindata/types"
import { areSetsEqual } from "@ourworldindata/utils"
import {
    CONTINENTS_INDICATOR_ID,
    DimensionSlot,
    findPotentialChartTypeSiblings,
} from "@ourworldindata/grapher"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { ChartEditor, isChartEditorInstance } from "./ChartEditor.js"
import {
    GDP_PER_CAPITA_CATALOG_PATH,
    POPULATION_CATALOG_PATH,
} from "./constants.js"

export function findDimensionSlot(
    editor: AbstractChartEditor,
    property: DimensionProperty
): DimensionSlot | undefined {
    return editor.grapherState.dimensionSlots.find(
        (slot) => slot.property === property
    )
}

/**
 * The parent config depends on the dimensions and the chart type (scatters
 * don't have a parent), so it is refetched after either changes.
 */
export async function syncParentConfig(
    editor: AbstractChartEditor
): Promise<void> {
    if (isChartEditorInstance(editor)) await editor.updateParentConfig()
}

export async function setSlotDimensions(
    editor: AbstractChartEditor,
    property: DimensionProperty,
    configs: OwidChartDimensionInterface[]
): Promise<void> {
    runInAction(() =>
        editor.grapherState.setDimensionsForProperty(property, configs)
    )
    await editor.commitDimensionsAndReloadData()
}

/**
 * Make `variableIds` the indicators in a slot (the variable selector hands
 * back the full list for the slot, existing ones included). Dimensions that
 * are already there keep their settings.
 */
export async function setSlotVariables(
    editor: AbstractChartEditor,
    property: DimensionProperty,
    variableIds: OwidVariableId[]
): Promise<void> {
    const slot = findDimensionSlot(editor, property)
    if (!slot) throw new Error(`The chart has no "${property}" dimension slot.`)

    const dimensionConfigs = variableIds.map((id) => {
        const existingDimension = slot.dimensions.find(
            (d) => d.variableId === id
        )
        return existingDimension || { property: slot.property, variableId: id }
    })

    await setSlotDimensions(editor, property, dimensionConfigs)
    await syncParentConfig(editor)
}

export async function removeVariableFromSlot(
    editor: AbstractChartEditor,
    property: DimensionProperty,
    variableId: OwidVariableId
): Promise<void> {
    const slot = findDimensionSlot(editor, property)
    if (!slot) throw new Error(`The chart has no "${property}" dimension slot.`)
    await setSlotDimensions(
        editor,
        property,
        slot.dimensions.filter((d) => d.variableId !== variableId)
    )
    await syncParentConfig(editor)
}

export function applyDefaultsForMarimekko(editor: AbstractChartEditor): void {
    const { grapherState } = editor
    runInAction(() => {
        grapherState.hideRelativeToggle = false
        grapherState.stackMode = StackMode.relative
    })
}

export async function applyDefaultsForScatter(
    editor: AbstractChartEditor
): Promise<void> {
    const { grapherState, variableIdsByCatalogPath = {} } = editor

    const existingDimensions = grapherState.dimensions.map((dim) =>
        dim.toObject()
    )
    const newDimensions: OwidChartDimensionInterface[] = [...existingDimensions]

    const hasX = existingDimensions.find(
        (d) => d.property === DimensionProperty.x
    )
    const hasColor = existingDimensions.find(
        (d) => d.property === DimensionProperty.color
    )
    const hasSize = existingDimensions.find(
        (d) => d.property === DimensionProperty.size
    )

    // Add default x indicator if not already present
    const gdpPerCapitaId = variableIdsByCatalogPath[GDP_PER_CAPITA_CATALOG_PATH]
    if (!hasX) {
        if (gdpPerCapitaId) {
            newDimensions.push({
                variableId: gdpPerCapitaId,
                property: DimensionProperty.x,
            })

            // GDP per capita is best viewed on a log scale,
            // so enable the log/linear switch and default to log
            runInAction(() => {
                grapherState.xAxis.canChangeScaleType = true
                grapherState.xAxis.scaleType = ScaleType.log
            })
        } else {
            console.error(
                `Could not resolve a variable id for catalog path "${GDP_PER_CAPITA_CATALOG_PATH}"; skipping the default x dimension.`
            )
        }
    }

    // Add default color indicator if not already present
    if (!hasColor)
        newDimensions.push({
            variableId: CONTINENTS_INDICATOR_ID,
            property: DimensionProperty.color,
        })

    // Add default size indicator if not already present
    const populationId = variableIdsByCatalogPath[POPULATION_CATALOG_PATH]
    if (!hasSize) {
        if (populationId) {
            newDimensions.push({
                variableId: populationId,
                property: DimensionProperty.size,
            })
        } else {
            console.error(
                `Could not resolve a variable id for catalog path "${POPULATION_CATALOG_PATH}"; skipping the default size dimension.`
            )
        }
    }

    // Update dimensions if any new ones were added
    if (newDimensions.length > existingDimensions.length) {
        await editor.commitDimensionsAndReloadData(newDimensions)
    }
}

async function applyDefaultsForChartType(
    editor: AbstractChartEditor,
    chartType: GrapherChartType,
    isPrimary: boolean
): Promise<void> {
    if (chartType === GRAPHER_CHART_TYPES.ScatterPlot) {
        await applyDefaultsForScatter(editor)
    } else if (chartType === GRAPHER_CHART_TYPES.Marimekko && isPrimary) {
        applyDefaultsForMarimekko(editor)
    }
}

/**
 * Enable a chart type. Types that can be combined (line + slope, the stacked
 * family) are appended; an incompatible type replaces the current selection.
 */
export async function addChartType(
    editor: AbstractChartEditor,
    chartType: GrapherChartType
): Promise<void> {
    const { grapherState } = editor
    if (grapherState.validChartTypeSet.has(chartType)) return

    // Check if the added chart type is compatible with the currently selected types
    const activeGroup =
        grapherState.chartTypes.length > 0
            ? findPotentialChartTypeSiblings(grapherState.chartTypes)
            : undefined
    const addedChartTypeGroup = findPotentialChartTypeSiblings([chartType])
    const isCompatible =
        addedChartTypeGroup !== undefined &&
        activeGroup !== undefined &&
        areSetsEqual(new Set(addedChartTypeGroup), new Set(activeGroup))

    runInAction(() => {
        grapherState.chartTypes = isCompatible
            ? // Append if the newly added chart type belongs to the same group
              [...grapherState.chartTypes, chartType]
            : // Replace all with just the new type if incompatible
              [chartType]
    })

    await applyDefaultsForChartType(
        editor,
        chartType,
        grapherState.chartType === chartType
    )
    await syncParentConfig(editor)
}

export async function removeChartType(
    editor: AbstractChartEditor,
    chartType: GrapherChartType
): Promise<void> {
    const { grapherState } = editor
    runInAction(() => {
        grapherState.chartTypes = grapherState.chartTypes.filter(
            (type) => type !== chartType
        )
    })
    await syncParentConfig(editor)
}

/** Tags are saved immediately, independent of the chart's own save. */
export async function saveChartTags(
    editor: ChartEditor,
    tags: DbChartTagJoin[]
): Promise<void> {
    const { grapherState, manager } = editor
    await manager.admin.requestJSON(
        `/api/charts/${grapherState.id}/setTags`,
        { tags },
        "POST"
    )
    runInAction(() => {
        manager.tags = tags
    })
}
