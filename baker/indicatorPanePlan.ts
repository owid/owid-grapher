import * as _ from "lodash-es"
import {
    AuxiliaryIndicator,
    AuxiliaryIndicatorMode,
    DimensionProperty,
    GRAPHER_CHART_TYPES,
    GrapherInterface,
    OwidChartDimensionInterface,
    OwidVariableWithSource,
} from "@ourworldindata/types"

/**
 * Which of a chart's indicators get a metadata pane on the redesigned data
 * page, in what order, and how each is labelled.
 *
 * - Every Y-indicator, in config order. The first Y is the primary pane.
 * - On a scatter plot, the X-indicator too: on "birth rate vs death rate"
 *   the x axis is as much the subject as the y. Y first, then X: 90% of
 *   scatter titles that name both put the y indicator first ("Access to
 *   electricity vs. GDP per capita").
 * - On a scatter plot, the size and colour indicators (almost always
 *   Population and World region), size before colour, according to
 *   `auxiliaryMode`: as panes ("panes", the default), as a one-line link
 *   ("line"), or as a link when the indicator has its own data page and a
 *   pane otherwise ("mixed"). An indicator already plotted on an axis is
 *   documented by its axis pane.
 * - The x-dimension of a non-scatter chart (e.g. a Marimekko's width) gets
 *   no pane.
 */
export interface IndicatorPanePlan {
    /** Pane indicators after the primary one, without duplicates. */
    additionalPaneVariableIds: number[]
    /** Size/colour indicators documented in the one-line link instead. */
    auxiliaryIndicators: AuxiliaryIndicator[] | undefined
    auxiliaryRoleFor: (
        variableId: number
    ) => AuxiliaryIndicator["role"] | undefined
    /**
     * The chart author's display.name for the indicator's dimension; blank
     * (the editor saves "" when the field is cleared) counts as unset.
     */
    chartDimensionNameFor: (variableId: number) => string | undefined
    /**
     * Per-indicator pane title for a multi-indicator chart, where the chart
     * title describes the whole chart rather than any one indicator: the
     * dimension name, else the variable's own display name or name, so two
     * indicators without a dimension name aren't both labelled with the
     * chart title.
     */
    indicatorTitleOverrideFor: (
        variableId: number,
        metadata: OwidVariableWithSource
    ) => string | undefined
}

export const auxiliaryRoleOf = (
    d: OwidChartDimensionInterface
): AuxiliaryIndicator["role"] =>
    d.property === DimensionProperty.size ? "size" : "color"

const isScatterPlot = (grapher: GrapherInterface): boolean =>
    grapher.chartTypes?.[0] === GRAPHER_CHART_TYPES.ScatterPlot

const axisDimensionsOf = (
    grapher: GrapherInterface
): OwidChartDimensionInterface[] => {
    const isScatter = isScatterPlot(grapher)
    return (grapher.dimensions ?? []).filter(
        (d) =>
            d.property === DimensionProperty.y ||
            (isScatter && d.property === DimensionProperty.x)
    )
}

type AuxiliaryDimension = OwidChartDimensionInterface & { variableId: number }

/** A scatter plot's size and colour dimensions, size first; [] otherwise. */
export function getAuxiliaryDimensions(
    grapher: GrapherInterface
): AuxiliaryDimension[] {
    if (!isScatterPlot(grapher)) return []
    const axisVariableIds = new Set(
        axisDimensionsOf(grapher).map((d) => d.variableId)
    )
    return _.sortBy(
        (grapher.dimensions ?? []).filter(
            (d): d is AuxiliaryDimension =>
                !!d.variableId &&
                (d.property === DimensionProperty.size ||
                    d.property === DimensionProperty.color) &&
                !axisVariableIds.has(d.variableId)
        ),
        (d) => (auxiliaryRoleOf(d) === "size" ? 0 : 1)
    )
}

/**
 * Whether a chart has two or more distinct indicators to document: several
 * Y-indicators, or a scatter plot's X / size / colour beside its Y. These are
 * the charts that are grapher pages today only because the `datapages` rules
 * want exactly one Y-indicator (and no scatter X); they bake as data pages
 * with one metadata pane per indicator.
 */
export function hasMultipleIndicators(grapher: GrapherInterface): boolean {
    const ids = new Set(
        [...axisDimensionsOf(grapher), ...getAuxiliaryDimensions(grapher)]
            .map((d) => d.variableId)
            .filter((id) => !!id)
    )
    return ids.size >= 2
}

export function planIndicatorPanes(
    grapher: GrapherInterface,
    {
        primaryVariableId,
        auxiliaryMode,
        auxiliaryLinks,
    }: {
        primaryVariableId: number
        auxiliaryMode: AuxiliaryIndicatorMode
        /** From getAuxiliaryIndicatorLinks for getAuxiliaryDimensions(grapher). */
        auxiliaryLinks: Map<number, { title: string; slug?: string }>
    }
): IndicatorPanePlan {
    const auxDims = getAuxiliaryDimensions(grapher)
    const isPane = (d: AuxiliaryDimension): boolean =>
        auxiliaryMode === "panes" ||
        (auxiliaryMode === "mixed" && !auxiliaryLinks.get(d.variableId)?.slug)
    const auxPaneDims = auxDims.filter(isPane)
    const auxLineDims = auxDims.filter((d) => !isPane(d))
    const paneDims = [...axisDimensionsOf(grapher), ...auxPaneDims]

    const chartDimensionNameFor = (variableId: number): string | undefined =>
        paneDims
            .find((d) => d.variableId === variableId)
            ?.display?.name?.trim() || undefined

    const auxiliaryIndicators = _.compact(
        auxLineDims.map((d): AuxiliaryIndicator | undefined => {
            const link = auxiliaryLinks.get(d.variableId)
            const title = d.display?.name?.trim() || link?.title
            return title
                ? { role: auxiliaryRoleOf(d), title, slug: link?.slug }
                : undefined
        })
    )

    return {
        additionalPaneVariableIds: _.uniq(
            _.compact(paneDims.map((d) => d.variableId))
        ).filter((id) => id !== primaryVariableId),
        auxiliaryIndicators: auxiliaryIndicators.length
            ? auxiliaryIndicators
            : undefined,
        auxiliaryRoleFor: (variableId) => {
            const d = auxPaneDims.find((a) => a.variableId === variableId)
            return d ? auxiliaryRoleOf(d) : undefined
        },
        chartDimensionNameFor,
        indicatorTitleOverrideFor: (variableId, metadata) =>
            chartDimensionNameFor(variableId) ??
            (metadata.display?.name?.trim() || metadata.name),
    }
}
