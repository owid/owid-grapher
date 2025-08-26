import {
    Choice,
    ChoicesEnriched,
    DimensionEnriched,
    IndicatorsAfterPreProcessing,
    MultiDimDimensionChoices,
    View,
    ViewEnriched,
    OwidChartDimensionInterface,
    DimensionProperty,
    MultiDimDataPageConfigEnriched,
    OwidVariableWithSourceAndDimension,
} from "@ourworldindata/types"
import * as _ from "lodash-es"
import { merge } from "./Util"

interface FilterToAvailableResult {
    selectedChoices: MultiDimDimensionChoices
    dimensionsWithAvailableChoices: Record<string, DimensionEnriched>
}

export class MultiDimDataPageConfig {
    private constructor(
        public readonly config: MultiDimDataPageConfigEnriched
    ) {}

    static fromJson(jsonString: string): MultiDimDataPageConfig {
        return new MultiDimDataPageConfig(JSON.parse(jsonString))
    }

    static fromObject(
        obj: MultiDimDataPageConfigEnriched
    ): MultiDimDataPageConfig {
        return new MultiDimDataPageConfig(obj)
    }

    private static getEnrichedChoicesFields(
        choices: Choice[]
    ): ChoicesEnriched {
        return {
            choices,
            choicesBySlug: _.keyBy(choices, "slug"),
            choicesByGroup: _.groupBy(choices, "group"),
        }
    }

    get dimensions(): Record<string, DimensionEnriched> {
        const dimensionsEnriched = this.config.dimensions.map((dimension) => ({
            ...dimension,
            ...MultiDimDataPageConfig.getEnrichedChoicesFields(
                dimension.choices
            ),
        }))
        return _.keyBy(dimensionsEnriched, "slug")
    }

    filterViewsByDimensions(
        dimensions: MultiDimDimensionChoices
    ): ViewEnriched[] {
        return this.config.views.filter((view) => {
            for (const [dimensionSlug, choiceSlug] of Object.entries(
                dimensions
            )) {
                if (view.dimensions[dimensionSlug] !== choiceSlug) return false
            }
            return true
        })
    }

    // This'll only ever find one or zero views, and will throw an error
    // if more than one matching views were found
    findViewByDimensions(
        dimensions: MultiDimDimensionChoices
    ): ViewEnriched | undefined {
        const matchingViews = this.filterViewsByDimensions(dimensions)
        if (matchingViews.length === 0) return undefined
        if (matchingViews.length > 1) {
            throw new Error(
                `Multiple views found for dimensions ${JSON.stringify(
                    dimensions
                )}`
            )
        }
        return matchingViews[0]
    }

    /**
     * This checks if matching views are available for the selected choices, and otherwise
     * adapts them in such a way that they are available, in the following way:
     * - Go through the choices left-to-right. The current dimension we're looking at is called `cur`.
     * - If there is at least one available view for choices[leftmost, ..., cur], continue.
     * - Otherwise, for dimension `cur`, find the first choice that has at least one available view.
     *
     * The method returns two values:
     * - `selectedChoices` is the updated version of the input `selectedChoices`, where choices have been adapted to make sure there are available views. It is fully-qualified, i.e. it has choices for all dimensions.
     * - `dimensionsWithAvailableChoices` indicates for each dimension which choices are available, and excludes the ones that are excluded by choices left of it.
     *
     * - @marcelgerber, 2024-07-22
     */
    filterToAvailableChoices(
        selectedChoices: MultiDimDimensionChoices
    ): FilterToAvailableResult {
        const updatedSelectedChoices: MultiDimDimensionChoices = {}
        const dimensionsWithAvailableChoices: Record<
            string,
            DimensionEnriched
        > = {}
        for (const [currentDimSlug, currentDim] of Object.entries(
            this.dimensions
        )) {
            const availableViewsBeforeSelection = this.filterViewsByDimensions(
                updatedSelectedChoices
            )
            if (
                selectedChoices[currentDimSlug] &&
                currentDim.choicesBySlug[selectedChoices[currentDimSlug]]
            ) {
                updatedSelectedChoices[currentDimSlug] =
                    selectedChoices[currentDimSlug]
            } else {
                updatedSelectedChoices[currentDimSlug] =
                    availableViewsBeforeSelection[0].dimensions[currentDimSlug]
            }

            const availableViewsAfterSelection = this.filterViewsByDimensions(
                updatedSelectedChoices
            )
            if (availableViewsAfterSelection.length === 0) {
                // If there are no views available after this selection, choose the first available view before this choice and update to its choice
                updatedSelectedChoices[currentDimSlug] =
                    availableViewsBeforeSelection[0].dimensions[currentDimSlug]
            }

            // Find all the available choices we can show for this dimension - these are all
            // the ones that are possible for this dimension with all of the previous choices
            // (i.e., left of this dimension) in mind.
            const availableChoicesForDimension = Object.values(
                currentDim.choices
            ).filter((choice) =>
                availableViewsBeforeSelection.some(
                    (view) => view.dimensions[currentDimSlug] === choice.slug
                )
            )
            dimensionsWithAvailableChoices[currentDimSlug] = {
                ...currentDim,
                ...MultiDimDataPageConfig.getEnrichedChoicesFields(
                    availableChoicesForDimension
                ),
            }
        }

        return {
            selectedChoices: updatedSelectedChoices,
            dimensionsWithAvailableChoices,
        }
    }

    mergeViewMetadata(
        dimensions: MultiDimDimensionChoices,
        variableMetadata: OwidVariableWithSourceAndDimension
    ): OwidVariableWithSourceAndDimension {
        const mdimConfigView = this.findViewByDimensions(dimensions)

        return merge(
            variableMetadata,
            this.config.metadata ?? {},
            mdimConfigView?.metadata ?? {}
        ) as OwidVariableWithSourceAndDimension
    }

    static viewToDimensionsConfig(
        view?: View<IndicatorsAfterPreProcessing>
    ): OwidChartDimensionInterface[] {
        const dimensions: OwidChartDimensionInterface[] = []
        if (!view?.indicators) return dimensions
        if (view.indicators.y) {
            dimensions.push(
                ...view.indicators.y.map(({ id, display }) => ({
                    property: DimensionProperty.y,
                    variableId: id,
                    display,
                }))
            )
        }
        if (view.indicators.x) {
            dimensions.push({
                property: DimensionProperty.x,
                variableId: view.indicators.x.id,
                display: view.indicators.x.display,
            })
        }
        if (view.indicators.size) {
            dimensions.push({
                property: DimensionProperty.size,
                variableId: view.indicators.size.id,
                display: view.indicators.size.display,
            })
        }
        if (view.indicators.color) {
            dimensions.push({
                property: DimensionProperty.color,
                variableId: view.indicators.color.id,
                display: view.indicators.color.display,
            })
        }
        return dimensions
    }
}

export const extractMultiDimChoicesFromSearchParams = (
    searchParams: URLSearchParams,
    config: MultiDimDataPageConfig
): MultiDimDimensionChoices => {
    const dimensions = config.dimensions
    const dimensionChoices: MultiDimDimensionChoices = {}
    for (const [key, value] of searchParams.entries()) {
        if (key in dimensions) {
            dimensionChoices[key] = value
        }
    }
    return dimensionChoices
}

export function searchParamsToMultiDimView(
    config: MultiDimDataPageConfigEnriched,
    searchParams: URLSearchParams
): ViewEnriched {
    const mdimConfig = MultiDimDataPageConfig.fromObject(config)
    let dimensions = extractMultiDimChoicesFromSearchParams(
        searchParams,
        mdimConfig
    )
    if (_.isEmpty(dimensions)) {
        // Get the default dimensions.
        dimensions = mdimConfig.filterToAvailableChoices({}).selectedChoices
    }
    const view = mdimConfig.findViewByDimensions(dimensions)
    if (!view) {
        throw new Error(
            `No view found for dimensions ${JSON.stringify(dimensions)}`
        )
    }
    return view
}
