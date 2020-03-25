import {
    extend,
    some,
    isString,
    isNumber,
    uniq,
    sortedUniq,
    min,
    max,
    sortBy,
    diffDateISOStringInDays
} from "./Util"
import { observable, computed } from "mobx"
import { EPOCH_DATE } from "settings"

export class VariableDisplaySettings {
    @observable name?: string = undefined
    @observable unit?: string = undefined
    @observable shortUnit?: string = undefined
    @observable isProjection?: true = undefined
    @observable conversionFactor?: number = undefined
    @observable numDecimalPlaces?: number = undefined
    @observable tolerance?: number = undefined
    @observable yearIsDay?: boolean = undefined
    @observable zeroDay?: string = undefined
    @observable entityAnnotationsMap?: string = undefined
}

export class Variable {
    @observable.ref id!: number
    @observable.ref name!: string
    @observable.ref description!: string
    @observable.ref unit!: string
    @observable.ref shortUnit!: string
    @observable.ref datasetName!: string
    @observable.ref datasetId!: string

    @observable.ref coverage?: string

    @observable display: VariableDisplaySettings = new VariableDisplaySettings()

    @observable.struct source!: {
        id: number
        name: string
        dataPublishedBy: string
        dataPublisherSource: string
        link: string
        retrievedDate: string
        additionalInfo: string
    }
    @observable.ref rawYears: number[] = []
    @observable.ref entities: string[] = []
    @observable.ref values: (string | number)[] = []

    constructor(json: any) {
        for (const key in this) {
            if (key === "rawYears") {
                this.rawYears = json.years
            } else if (key in json) {
                if (key === "display") {
                    extend(this.display, json.display)
                } else {
                    this[key] = json[key]
                }
            }
        }
    }

    @computed get years(): number[] {
        if (this.display.yearIsDay && this.display.zeroDay !== undefined) {
            const diff = diffDateISOStringInDays(
                this.display.zeroDay,
                EPOCH_DATE
            )
            return this.rawYears.map(y => y + diff)
        }
        return this.rawYears
    }

    @computed get annotationMap() {
        const map = new Map()
        if (!this.display.entityAnnotationsMap) return map
        const delimiter = ":"
        this.display.entityAnnotationsMap.split("\n").forEach(line => {
            const [key, ...words] = line
                .split(delimiter)
                .map(word => word.trim())
            map.set(key, words.join(delimiter))
        })
        return map
    }

    @computed get hasNumericValues(): boolean {
        return some(this.values, v => isFinite(v as number))
    }

    @computed get numericValues(): number[] {
        return sortBy(this.values.filter(v => isNumber(v))) as number[]
    }

    @computed get categoricalValues(): string[] {
        return uniq(this.values.filter(v => isString(v))) as string[]
    }

    @computed get hasCategoricalValues(): boolean {
        return some(this.values, v => isString(v))
    }

    @computed get entitiesUniq(): string[] {
        return uniq(this.entities)
    }

    @computed get yearsUniq(): number[] {
        return sortedUniq(this.years)
    }

    @computed get minYear(): number {
        return min(this.yearsUniq) as number
    }

    @computed get maxYear(): number {
        return max(this.yearsUniq) as number
    }

    @computed get minValue(): number {
        return min(this.numericValues) as number
    }

    @computed get maxValue(): number {
        return max(this.numericValues) as number
    }

    @computed get isNumeric(): boolean {
        return this.hasNumericValues && !this.hasCategoricalValues
    }
}
