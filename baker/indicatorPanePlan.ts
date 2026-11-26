import * as _ from "lodash-es"
import {
    AuxiliaryIndicatorRole,
    DimensionProperty,
    GRAPHER_CHART_TYPES,
    GrapherInterface,
} from "@ourworldindata/types"

export interface PlannedIndicatorPane {
    variableId: number
    /** The chart author's name for the indicator's dimension, if they set one */
    chartDimensionName?: string
    auxiliaryRole?: AuxiliaryIndicatorRole
}

const AUXILIARY_ROLE_BY_PROPERTY: Partial<
    Record<DimensionProperty, AuxiliaryIndicatorRole>
> = {
    [DimensionProperty.size]: "size",
    [DimensionProperty.color]: "color",
}

/**
 * The indicators of a chart that get a pane in the data page's metadata box,
 * in display order, each once:
 * - Every Y-indicator.
 * - On a scatter plot, the X-indicator, which is as much its subject as the
 *   Y: titles that name both put the Y first ("Access to electricity vs. GDP
 *   per capita").
 * - On a scatter plot, the indicators that only set the bubbles' size and
 *   colour, in that order.
 *
 * Another chart type's X-indicator (a Marimekko's width) gets no pane.
 */
export function planIndicatorPanes(
    grapher: GrapherInterface
): PlannedIndicatorPane[] {
    const isScatterPlot =
        grapher.chartTypes?.[0] === GRAPHER_CHART_TYPES.ScatterPlot
    const dimensions = grapher.dimensions ?? []
    const axisDimensions = dimensions.filter(
        ({ property }) =>
            property === DimensionProperty.y ||
            (isScatterPlot && property === DimensionProperty.x)
    )
    const auxiliaryDimensions = isScatterPlot
        ? [DimensionProperty.size, DimensionProperty.color].flatMap(
              (auxiliaryProperty) =>
                  dimensions.filter(
                      ({ property }) => property === auxiliaryProperty
                  )
          )
        : []

    const panes = [...axisDimensions, ...auxiliaryDimensions].flatMap(
        ({ variableId, display, property }): PlannedIndicatorPane[] =>
            variableId
                ? [
                      {
                          variableId,
                          // The chart editor saves "" when the name is cleared
                          chartDimensionName:
                              display?.name?.trim() || undefined,
                          auxiliaryRole: AUXILIARY_ROLE_BY_PROPERTY[property],
                      },
                  ]
                : []
    )
    return _.uniqBy(panes, (pane) => pane.variableId)
}

/**
 * Charts with several indicators to document are data pages whether or not
 * they have a `datapages` row, which wants exactly one Y-indicator and no
 * scatter plot X.
 */
export const hasMultipleIndicators = (grapher: GrapherInterface): boolean =>
    planIndicatorPanes(grapher).length > 1
