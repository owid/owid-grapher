import { observable } from "mobx"
import { Color } from "grapher/core/GrapherConstants"
import { BinningStrategy } from "./BinningStrategies"
import {
    deleteRuntimeAndUnchangedProps,
    objectWithPersistablesToObject,
    Persistable,
    updatePersistables,
} from "grapher/persistable/Persistable"
import { extend, trimObject } from "grapher/utils/Util"

class ColorScaleConfigDefaults {
    // Color scheme
    // ============

    /** Key for a colorbrewer scheme */
    @observable baseColorScheme?: string

    /** Reverse the order of colors in the color scheme (defined by `baseColorScheme`) */
    @observable colorSchemeInvert?: true = undefined

    // Numeric bins
    // ============

    /** The strategy for generating the bin boundaries */
    @observable binningStrategy: BinningStrategy = BinningStrategy.ckmeans
    /** The *suggested* number of bins for the automatic binning algorithm */
    @observable binningStrategyBinCount?: number

    /** The minimum bracket of the first bin */
    @observable customNumericMinValue?: number
    /** Custom maximum brackets for each numeric bin. Only applied when strategy is `manual`. */
    @observable customNumericValues: number[] = []
    /**
     * Custom labels for each numeric bin. Only applied when strategy is `manual`.
     * `undefined` or `null` falls back to default label.
     * We need to handle `null` because JSON serializes `undefined` values
     * inside arrays into `null`.
     */
    @observable customNumericLabels: (string | undefined | null)[] = []

    /** Whether `customNumericColors` are used to override the color scheme. */
    @observable customNumericColorsActive?: true = undefined
    /**
     * Override some or all colors for the numerical color legend.
     * `undefined` or `null` falls back the color scheme color.
     * We need to handle `null` because JSON serializes `undefined` values
     * inside arrays into `null`.
     */
    @observable customNumericColors: (Color | undefined | null)[] = []

    /** Whether the visual scaling for the color legend is disabled. */
    @observable equalSizeBins?: true = undefined

    // Categorical bins
    // ================

    @observable.ref customCategoryColors: {
        [key: string]: string | undefined
    } = {}

    @observable.ref customCategoryLabels: {
        [key: string]: string | undefined
    } = {}

    // Allow hiding categories from the legend
    @observable.ref customHiddenCategories: {
        [key: string]: true | undefined
    } = {}

    // Other
    // =====

    /** A custom legend description. Only used in ScatterPlot legend titles for now. */
    @observable legendDescription?: string = undefined
}

export type ColorScaleConfigInterface = ColorScaleConfigDefaults

export class ColorScaleConfig
    extends ColorScaleConfigDefaults
    implements Persistable {
    updateFromObject(obj: any) {
        extend(this, obj)
    }

    toObject() {
        const obj = objectWithPersistablesToObject(this)
        deleteRuntimeAndUnchangedProps(obj, new ColorScaleConfigDefaults())
        return trimObject(obj)
    }

    constructor(obj?: Partial<ColorScaleConfig>) {
        super()
        updatePersistables(this, obj)
    }
}
