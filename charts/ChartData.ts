import {
    map,
    keyBy,
    includes,
    uniqWith,
    cloneDeep,
    union,
    each,
    sortBy,
    without,
    find,
    uniq,
    lastOfNonEmptyArray
} from "./Util"
import { computed, action } from "mobx"
import { ChartConfig } from "./ChartConfig"
import { EntityDimensionKey } from "./EntityDimensionKey"
import { Color } from "./Color"
import { ChartDimensionWithOwidVariable } from "./ChartDimensionWithOwidVariable"
import { OwidSource } from "./owidData/OwidSource"
import { entityName, entityId, entityCode } from "./owidData/OwidTable"

export interface EntityDimensionInfo {
    entityName: entityName
    entityId: entityId
    dimension: ChartDimensionWithOwidVariable
    index: number
    entityDimensionKey: EntityDimensionKey
    fullLabel: string
    label: string
    shortCode: string
}

export interface SourceWithDimension {
    source: OwidSource
    dimension: ChartDimensionWithOwidVariable
}

// This component computes useful information using both the chart configuration and the actual data
// Where possible, code should go in the individual chart type transforms instead and be exposed via interface
export class ChartData {
    chart: ChartConfig

    constructor(chart: ChartConfig) {
        this.chart = chart
    }

    // ChartData is ready to go iff we have retrieved data for every variable associated with the chart
    @computed get isReady(): boolean {
        return this.loadingVarIds.length === 0
    }

    @computed get loadingVarIds(): number[] {
        const { chart } = this
        return chart.dimensions
            .map(dim => dim.variableId)
            .filter(id => !chart.table.columnsByOwidVarId.has(id))
    }

    @computed.struct get filledDimensions(): ChartDimensionWithOwidVariable[] {
        if (!this.isReady) return []

        return map(this.chart.dimensions, (dim, i) => {
            return new ChartDimensionWithOwidVariable(
                i,
                dim,
                this.chart.table.columnsByOwidVarId.get(dim.variableId)!
            )
        })
    }

    @computed get primaryDimensions() {
        return this.filledDimensions.filter(dim => dim.property === "y")
    }

    @computed get axisDimensions() {
        return this.filledDimensions.filter(
            dim => dim.property === "y" || dim.property === "x"
        )
    }

    // todo: remove
    // Make a unique string key for an entity on a variable
    makeEntityDimensionKey(
        entityName: entityName,
        dimensionIndex: number
    ): EntityDimensionKey {
        return `${entityName}_${dimensionIndex}`
    }

    @computed get dimensionsByField(): {
        [key: string]: ChartDimensionWithOwidVariable
    } {
        return keyBy(this.filledDimensions, "property")
    }

    // todo: remove
    @computed get hasSelection() {
        return this.chart.props.selectedData.length > 0
    }

    // todo: remove
    @computed private get selectionData(): Array<{
        entityDimensionKey: EntityDimensionKey
        color?: Color
    }> {
        const { chart, primaryDimensions } = this
        const entityIdToNameMap = chart.table.entityIdToNameMap
        let validSelections = chart.props.selectedData.filter(sel => {
            // Must be a dimension that's on the chart
            const dimension = primaryDimensions[sel.index]
            if (!dimension) return false

            // Entity must be within that dimension
            const entityName = entityIdToNameMap.get(sel.entityId)
            if (!entityName || !includes(dimension.entityNamesUniq, entityName))
                return false

            // "change entity" charts can only have one entity selected
            if (
                chart.addCountryMode === "change-country" &&
                sel.entityId !==
                    lastOfNonEmptyArray(chart.props.selectedData).entityId
            )
                return false

            return true
        })

        validSelections = uniqWith(
            validSelections,
            (a: any, b: any) => a.entityId === b.entityId && a.index === b.index
        )

        return map(validSelections, sel => {
            return {
                entityDimensionKey: this.makeEntityDimensionKey(
                    entityIdToNameMap.get(sel.entityId)!,
                    sel.index
                ),
                color: sel.color
            }
        })
    }

    // todo: remove
    selectEntityDimensionKey(key: EntityDimensionKey) {
        this.selectedKeys = this.selectedKeys.concat([key])
    }

    // todo: remove
    @computed.struct get keyColors(): {
        [entityDimensionKey: string]: Color | undefined
    } {
        const keyColors: {
            [entityDimensionKey: string]: Color | undefined
        } = {}
        this.selectionData.forEach(d => {
            if (d.color) keyColors[d.entityDimensionKey] = d.color
        })
        return keyColors
    }

    // todo: remove
    setKeyColor(key: EntityDimensionKey, color: Color | undefined) {
        const meta = this.lookupKey(key)
        const selectedData = cloneDeep(this.chart.props.selectedData)
        selectedData.forEach(d => {
            if (d.entityId === meta.entityId && d.index === meta.index) {
                d.color = color
            }
        })
        this.chart.props.selectedData = selectedData
    }

    // todo: remove
    @computed get selectedEntityNames(): entityName[] {
        return uniq(
            this.selectedKeys.map(key => this.lookupKey(key).entityName)
        )
    }

    // todo: remove
    @computed get availableEntityNames(): entityName[] {
        const entitiesForDimensions = this.axisDimensions.map(dim => {
            return this.availableKeys
                .map(key => this.lookupKey(key))
                .filter(d => d.dimension.variableId === dim.variableId)
                .map(d => d.entityName)
        })

        return union(...entitiesForDimensions)
    }

    // todo: remove
    @action.bound setSelectedEntity(entityId: entityId) {
        const selectedData = cloneDeep(this.chart.props.selectedData)
        selectedData.forEach(d => (d.entityId = entityId))
        this.chart.props.selectedData = selectedData
    }

    // todo: remove
    @action.bound setSelectedEntitiesByCode(entityCodes: entityCode[]) {
        const matchedEntities = new Map<string, boolean>()
        entityCodes.forEach(code => matchedEntities.set(code, false))
        if (this.chart.canChangeEntity) {
            this.availableEntityNames.forEach(entityName => {
                const entityId = this.chart.table.entityNameToIdMap.get(
                    entityName
                )!
                const entityCode = this.chart.table.entityNameToCodeMap.get(
                    entityName
                )
                if (
                    entityCode === entityCodes[0] ||
                    entityName === entityCodes[0]
                ) {
                    matchedEntities.set(entityCodes[0], true)
                    this.setSelectedEntity(entityId)
                }
            })
        } else {
            this.selectedKeys = this.availableKeys.filter(key => {
                const meta = this.lookupKey(key)
                const entityName = meta.entityName
                const entityCode = this.chart.table.entityNameToCodeMap.get(
                    entityName
                )
                return [meta.shortCode, entityCode, entityName]
                    .map(key => {
                        if (!matchedEntities.has(key!)) return false
                        matchedEntities.set(key!, true)
                        return true
                    })
                    .some(item => item)
            })
        }
        return matchedEntities
    }

    // todo: remove
    @action.bound resetSelectedEntities() {
        this.chart.props.selectedData = this.chart.initialProps.selectedData
    }

    // todo: remove
    @computed get selectedEntityCodes(): entityCode[] {
        return uniq(this.selectedKeys.map(k => this.lookupKey(k).shortCode))
    }

    // todo: remove
    @computed get selectedKeys(): EntityDimensionKey[] {
        return this.selectionData.map(d => d.entityDimensionKey)
    }

    // Map keys back to their components for storage
    set selectedKeys(keys: EntityDimensionKey[]) {
        const { chart } = this
        if (!this.isReady) return

        const selection = map(keys, key => {
            const { entityName: entity, index } = this.lookupKey(key)
            return {
                entityId: this.chart.table.entityNameToIdMap.get(entity)!,
                index: index,
                color: this.keyColors[key]
            }
        })
        chart.props.selectedData = selection
    }

    // todo: remove
    @computed get selectedKeysByKey(): {
        [entityDimensionKey: string]: EntityDimensionKey
    } {
        return keyBy(this.selectedKeys)
    }

    // todo: remove this
    // Calculate the available entityDimensionKeys and their associated info
    @computed get entityDimensionMap(): Map<
        EntityDimensionKey,
        EntityDimensionInfo
    > {
        if (!this.isReady) return new Map()
        const { chart, primaryDimensions } = this
        const { isSingleEntity, isSingleVariable } = chart

        const keyData = new Map<EntityDimensionKey, EntityDimensionInfo>()
        primaryDimensions.forEach((dimension, dimensionIndex) => {
            dimension.entityNamesUniq.forEach(entityName => {
                const entityCode = chart.table.entityNameToCodeMap.get(
                    entityName
                )
                const entityId = chart.table.entityNameToIdMap.get(entityName)!
                const entityDimensionKey = this.makeEntityDimensionKey(
                    entityName,
                    dimensionIndex
                )

                // Full label completely represents the data in the key and is used in the editor
                const fullLabel = `${entityName} - ${dimension.displayName}`

                // The output label however is context-dependent
                let label = fullLabel
                if (isSingleVariable) {
                    label = entityName
                } else if (isSingleEntity) {
                    label = `${dimension.displayName}`
                }

                keyData.set(entityDimensionKey, {
                    entityDimensionKey,
                    entityId,
                    entityName: entityName,
                    dimension,
                    index: dimensionIndex,
                    fullLabel,
                    label,
                    shortCode:
                        primaryDimensions.length > 1 &&
                        chart.addCountryMode !== "change-country"
                            ? `${entityCode || entityName}-${dimension.index}`
                            : entityCode || entityName
                })
            })
        })

        return keyData
    }

    // todo: remove
    @computed.struct get availableKeys(): EntityDimensionKey[] {
        return sortBy([...Array.from(this.entityDimensionMap.keys())])
    }

    // todo: remove
    @computed.struct get remainingKeys(): EntityDimensionKey[] {
        const { availableKeys, selectedKeys } = this
        return without(availableKeys, ...selectedKeys)
    }

    // todo: remove
    @computed get availableKeysByEntity(): Map<
        entityName,
        EntityDimensionKey[]
    > {
        const keysByEntity = new Map()
        this.entityDimensionMap.forEach((info, key) => {
            const keys = keysByEntity.get(info.entityName) || []
            keys.push(key)
            keysByEntity.set(info.entityName, keys)
        })
        return keysByEntity
    }

    // todo: remove
    lookupKey(key: EntityDimensionKey): EntityDimensionInfo {
        const keyDatum = this.entityDimensionMap.get(key)
        if (keyDatum !== undefined) return keyDatum
        else throw new Error(`Unknown data key: ${key}`)
    }

    // todo: remove
    getLabelForKey(key: EntityDimensionKey): string {
        return this.lookupKey(key).label
    }

    // todo: remove
    toggleKey(key: EntityDimensionKey) {
        if (includes(this.selectedKeys, key)) {
            this.selectedKeys = this.selectedKeys.filter(k => k !== key)
        } else {
            this.selectedKeys = this.selectedKeys.concat([key])
        }
    }

    @computed get primaryVariableId() {
        const yDimension = find(this.chart.dimensions, { property: "y" })
        return yDimension ? yDimension.variableId : undefined
    }

    @computed get sourcesWithDimension(): SourceWithDimension[] {
        const { filledDimensions } = this

        const sources: SourceWithDimension[] = []
        each(filledDimensions, dim => {
            const { column } = dim
            // HACK (Mispy): Ignore the default color source on scatterplots.
            if (
                column.name !== "Countries Continents" &&
                column.name !== "Total population (Gapminder)"
            )
                sources.push({ source: column.source!, dimension: dim })
        })
        return sources
    }
}
