import { observable } from "mobx"

import { Color } from "./Color"

export class ColorScaleConfigProps {
    // Key for a colorbrewer scheme, may then be further customized
    @observable.ref baseColorScheme?: string

    // Minimum value shown on map legend
    @observable.ref colorSchemeMinValue?: number
    @observable colorSchemeValues: number[] = []
    @observable colorSchemeLabels: (string | undefined)[] = []
    @observable.ref isManualBuckets?: true = undefined
    @observable.ref equalSizeBins?: true = undefined

    // Whether to reverse the color scheme on output
    @observable.ref colorSchemeInvert?: true = undefined
    @observable.ref customColorsActive?: true = undefined

    // e.g. ["#000", "#c00", "#0c0", "#00c", "#c0c"]
    @observable customNumericColors: (Color | undefined)[] = []

    // e.g. { 'foo' => '#c00' }
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

    @observable.ref legendDescription?: string = undefined

    constructor(json?: Partial<ColorScaleConfigProps>) {
        if (json !== undefined) {
            for (const key in this) {
                if (key in json) {
                    this[key] = (json as any)[key]
                }
            }
        }
    }
}
