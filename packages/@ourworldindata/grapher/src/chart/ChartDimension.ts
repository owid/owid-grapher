import { observable, computed, makeObservable } from "mobx"
import {
    trimObject,
    ColumnSlug,
    DimensionProperty,
    OwidVariableId,
    Persistable,
    updatePersistables,
    OwidVariableDisplayConfig,
    OwidChartDimensionInterface,
    Time,
    deleteRuntimeAndUnchangedProps,
    objectWithPersistablesToObject,
    type PersistedObject,
} from "@ourworldindata/utils"
import {
    type SlugDimensionInterface,
    type IndicatorDimensionInterface,
    isIndicatorDimension,
} from "@ourworldindata/types"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"

export interface LegacyDimensionsManager {
    table: OwidTable
}

type IndicatorSource = Pick<
    IndicatorDimensionInterface,
    "variableId" | "targetYear"
>
type SlugSource = Pick<SlugDimensionInterface, "slug">
type DimensionSource = IndicatorSource | SlugSource

const isIndicatorSource = (
    source: DimensionSource
): source is IndicatorSource => "variableId" in source

export function getIndicatorColumnSlug({
    variableId,
    targetYear,
}: IndicatorSource): ColumnSlug {
    if (targetYear) return `${variableId}-${targetYear}`
    return variableId.toString()
}

class ChartDimensionDefaults {
    property!: DimensionProperty
    display = new OwidVariableDisplayConfig()

    constructor() {
        makeObservable(this, {
            property: observable,
            display: observable,
        })
    }
}

export class ChartDimension
    extends ChartDimensionDefaults
    implements Persistable
{
    source!: DimensionSource

    // ES-private so toJS() in toObject() doesn't walk into the manager
    readonly #manager: LegacyDimensionsManager

    constructor(
        obj: OwidChartDimensionInterface,
        manager: LegacyDimensionsManager
    ) {
        super()
        makeObservable(this, { source: observable.ref })
        this.#manager = manager
        this.updateFromObject(obj)
    }

    @computed private get table(): OwidTable {
        return this.#manager.table
    }

    updateFromObject(obj: OwidChartDimensionInterface): void {
        if (obj.display) updatePersistables(this, { display: obj.display })

        this.property = obj.property
        this.source = isIndicatorDimension(obj)
            ? { variableId: obj.variableId, targetYear: obj.targetYear }
            : { slug: obj.slug }
    }

    toObject(): OwidChartDimensionInterface {
        const obj: PersistedObject<ChartDimensionDefaults> =
            objectWithPersistablesToObject(this)
        deleteRuntimeAndUnchangedProps(obj, new ChartDimensionDefaults())
        return trimObject({ ...obj, ...this.source })
    }

    @computed private get indicatorSource(): IndicatorSource | undefined {
        return isIndicatorSource(this.source) ? this.source : undefined
    }

    @computed get variableId(): OwidVariableId | undefined {
        return this.indicatorSource?.variableId
    }

    @computed get column(): CoreColumn {
        return this.table.get(this.columnSlug)
    }

    @computed get columnSlug(): ColumnSlug {
        return isIndicatorSource(this.source)
            ? getIndicatorColumnSlug(this.source)
            : this.source.slug
    }

    // TODO: move this somewhere else, it's only used for scatter x override and Marimekko override
    @computed get targetYear(): Time | undefined {
        return this.indicatorSource?.targetYear
    }

    set targetYear(value: Time | undefined) {
        if (!isIndicatorSource(this.source)) {
            if (value === undefined) return
            throw new Error(
                `Cannot pin host column "${this.source.slug}" to a year; targetYear needs a variableId dimension`
            )
        }
        this.source = { ...this.source, targetYear: value }
    }
}
