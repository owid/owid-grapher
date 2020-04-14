import {
    map,
    every,
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
    defaultTo,
    slugify,
    lastOfNonEmptyArray
} from "./Util"
import { computed, toJS } from "mobx"
import { ChartConfig } from "./ChartConfig"
import { EntityDimensionKey } from "./EntityDimensionKey"
import { Color } from "./Color"
import { ChartDimensionWithOwidVariable } from "./ChartDimensionWithOwidVariable"
import { OwidSource } from "./owidData/OwidSource"

export interface EntityDimensionInfo {
    entity: string
    entityId: number
    dimension: ChartDimensionWithOwidVariable
    index: number
    key: string
    fullLabel: string
    label: string
    annotation?: string
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
        const { chart } = this
        return every(
            chart.dimensions,
            dim => !!chart.variablesById[dim.variableId]
        )
    }

    @computed.struct get filledDimensions(): ChartDimensionWithOwidVariable[] {
        if (!this.isReady) return []

        return map(this.chart.dimensions, (dim, i) => {
            const variable = this.chart.variablesById[dim.variableId]
            return new ChartDimensionWithOwidVariable(i, dim, variable)
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

    @computed private get defaultTitle(): string {
        if (this.chart.isScatter)
            return this.axisDimensions.map(d => d.displayName).join(" vs. ")
        else if (
            this.primaryDimensions.length > 1 &&
            uniq(map(this.primaryDimensions, d => d.variable.datasetName))
                .length === 1
        )
            return this.primaryDimensions[0].variable.datasetName
        else if (this.primaryDimensions.length === 2)
            return this.primaryDimensions.map(d => d.displayName).join(" and ")
        else return this.primaryDimensions.map(d => d.displayName).join(", ")
    }

    @computed get title(): string {
        return this.chart.props.title !== undefined
            ? this.chart.props.title
            : this.defaultTitle
    }

    // XXX refactor into the transforms
    @computed get minYear(): number {
        const { chart } = this
        //if (chart.isScatter && !chart.scatter.failMessage && chart.scatter.xOverrideYear != undefined)
        //    return undefined
        if (chart.primaryTab === "map") return chart.map.data.targetYear
        else if (chart.isScatter && !chart.scatter.failMessage)
            return chart.scatter.startYear
        else if (chart.isDiscreteBar && !chart.discreteBar.failMessage)
            return chart.discreteBar.targetYear
        else return chart.lineChart.startYear
    }

    @computed get maxYear(): number {
        const { chart } = this
        //if (chart.isScatter && !chart.scatter.failMessage && chart.scatter.xOverrideYear != undefined)
        //    return undefined
        if (chart.primaryTab === "map") return chart.map.data.targetYear
        else if (chart.isScatter && !chart.scatter.failMessage)
            return chart.scatter.endYear
        else if (chart.isDiscreteBar && !chart.discreteBar.failMessage)
            return chart.discreteBar.targetYear
        else return chart.lineChart.endYear
    }

    @computed get currentTitle(): string {
        const { chart } = this
        let text = this.title

        if (
            chart.primaryTab === "chart" &&
            chart.addCountryMode !== "add-country" &&
            chart.data.selectedEntities.length === 1 &&
            (!chart.props.hideTitleAnnotation || this.canChangeEntity)
        ) {
            const { selectedEntities } = chart.data
            const entityStr = selectedEntities.join(", ")
            if (entityStr.length > 0) {
                text = text + ", " + entityStr
            }
        }

        if (
            !chart.props.hideTitleAnnotation &&
            chart.isLineChart &&
            chart.lineChart.isRelativeMode
        ) {
            text =
                "Change in " +
                (text.charAt(1).match(/[A-Z]/)
                    ? text
                    : text.charAt(0).toLowerCase() + text.slice(1))
        }

        // Causes difficulties with charts like https://ourworldindata.org/grapher/antibiotic-use-in-livestock-in-europe
        /*if (chart.props.tab === "map" && chart.map.props.projection !== "World") {
            const label = labelsByRegion[chart.map.props.projection]
            text = text + ` in ${label}`
        }*/

        if (
            !chart.props.hideTitleAnnotation ||
            (this.chart.isLineChart &&
                this.chart.lineChart.isSingleYear &&
                this.chart.lineChart.hasTimeline) ||
            (this.chart.primaryTab === "map" && this.chart.map.data.hasTimeline)
        ) {
            const { minYear, maxYear } = this
            const timeFrom = chart.formatYearFunction(minYear)
            const timeTo = chart.formatYearFunction(maxYear)
            const time =
                timeFrom === timeTo ? timeFrom : timeFrom + " to " + timeTo

            text = text + ", " + time
        }

        return text.trim()
    }

    @computed private get defaultSlug(): string {
        return slugify(this.title)
    }

    @computed get slug(): string {
        return defaultTo(this.chart.props.slug, this.defaultSlug)
    }

    @computed get originUrl(): string {
        let url = this.chart.props.originUrl || ""
        if (!url.startsWith("http")) url = "https://" + url
        return url
    }

    @computed private get defaultSourcesLine(): string {
        let sourceNames = this.sourcesWithDimension.map(
            source => source.source.name
        )

        // Shorten automatic source names for certain major sources
        sourceNames = sourceNames.map(sourceName => {
            for (const majorSource of [
                "World Bank – WDI",
                "World Bank",
                "ILOSTAT"
            ]) {
                if (sourceName.startsWith(majorSource)) return majorSource
            }
            return sourceName
        })

        return uniq(sourceNames).join(", ")
    }

    @computed get sourcesLine(): string {
        return this.chart.props.sourceDesc !== undefined
            ? this.chart.props.sourceDesc
            : this.defaultSourcesLine
    }

    @computed get isSingleEntity(): boolean {
        return (
            this.chart.availableEntities.length === 1 ||
            this.chart.addCountryMode === "change-country"
        )
    }

    @computed private get isSingleVariable(): boolean {
        return this.primaryDimensions.length === 1
    }

    // Make a unique string key for an entity on a variable
    makeEntityDimensionKey(
        entity: string,
        dimensionIndex: number
    ): EntityDimensionKey {
        return `${entity}_${dimensionIndex}`
    }

    @computed get dimensionsByField(): {
        [key: string]: ChartDimensionWithOwidVariable
    } {
        return keyBy(this.filledDimensions, "property")
    }

    @computed get hasSelection() {
        return this.chart.props.selectedData.length > 0
    }

    @computed private get selectionData(): Array<{
        key: EntityDimensionKey
        color?: Color
    }> {
        const { chart, primaryDimensions } = this
        let validSelections = chart.props.selectedData.filter(sel => {
            // Must be a dimension that's on the chart
            const dimension = primaryDimensions[sel.index]
            if (!dimension) return false

            // Entity must be within that dimension
            const entityMeta = chart.entityMetaById[sel.entityId]
            if (
                !entityMeta ||
                !includes(dimension.variable.entitiesUniq, entityMeta.name)
            )
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
                key: this.makeEntityDimensionKey(
                    chart.entityMetaById[sel.entityId].name,
                    sel.index
                ),
                color: sel.color
            }
        })
    }

    selectKey(key: EntityDimensionKey) {
        this.selectedKeys = this.selectedKeys.concat([key])
    }

    @computed.struct get keyColors(): { [datakey: string]: Color | undefined } {
        const keyColors: { [datakey: string]: Color | undefined } = {}
        this.selectionData.forEach(d => {
            if (d.color) keyColors[d.key] = d.color
        })
        return keyColors
    }

    setKeyColor(datakey: EntityDimensionKey, color: Color | undefined) {
        const meta = this.lookupKey(datakey)
        const selectedData = cloneDeep(this.chart.props.selectedData)
        selectedData.forEach(d => {
            if (d.entityId === meta.entityId && d.index === meta.index) {
                d.color = color
            }
        })
        this.chart.props.selectedData = selectedData
    }

    @computed get selectedEntities(): string[] {
        return uniq(this.selectedKeys.map(key => this.lookupKey(key).entity))
    }

    @computed get availableEntities(): string[] {
        const entitiesForDimensions = this.axisDimensions.map(dim => {
            return this.availableKeys
                .map(key => this.lookupKey(key))
                .filter(d => d.dimension.variableId === dim.variableId)
                .map(d => d.entity)
        })

        return union(...entitiesForDimensions)
    }

    @computed get availableEntitiesToReader(): string[] {
        return this.chart.props.addCountryMode === "disabled"
            ? []
            : this.availableEntities
    }

    switchEntity(entityId: number) {
        const selectedData = cloneDeep(this.chart.props.selectedData)
        selectedData.forEach(d => (d.entityId = entityId))
        this.chart.props.selectedData = selectedData
    }

    @computed get selectedKeys(): EntityDimensionKey[] {
        return this.selectionData.map(d => d.key)
    }

    // Map keys back to their components for storage
    set selectedKeys(keys: EntityDimensionKey[]) {
        const { chart } = this
        if (!this.isReady) return

        const selection = map(keys, datakey => {
            const { entity, index } = this.lookupKey(datakey)
            return {
                entityId: chart.entityMetaByKey[entity].id,
                index: index,
                color: this.keyColors[datakey]
            }
        })
        chart.props.selectedData = selection
    }

    @computed get selectedKeysByKey(): { [key: string]: EntityDimensionKey } {
        return keyBy(this.selectedKeys)
    }

    // Calculate the available datakeys and their associated info
    @computed get entityDimensionMap(): Map<
        EntityDimensionKey,
        EntityDimensionInfo
    > {
        if (!this.isReady) return new Map()
        const {
            chart,
            isSingleEntity,
            isSingleVariable,
            primaryDimensions
        } = this

        const keyData = new Map()
        primaryDimensions.forEach((dimension, dimensionIndex) => {
            const annotationMap = dimension.variable.annotationMap
            dimension.variable.entitiesUniq.forEach(entityName => {
                const entityMeta = chart.entityMetaByKey[entityName]
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

                const annotationKey = entityName

                keyData.set(entityDimensionKey, {
                    key: entityDimensionKey,
                    entityId: entityMeta.id,
                    entity: entityName,
                    annotation: annotationMap.get(annotationKey),
                    dimension,
                    index: dimensionIndex,
                    fullLabel,
                    label,
                    shortCode:
                        primaryDimensions.length > 1 &&
                        chart.addCountryMode !== "change-country"
                            ? `${entityMeta.code || entityMeta.name}-${
                                  dimension.index
                              }`
                            : entityMeta.code || entityMeta.name
                })
            })
        })

        return keyData
    }

    @computed get canAddData(): boolean {
        return (
            this.chart.addCountryMode === "add-country" &&
            this.availableKeys.length > 1
        )
    }

    @computed get canChangeEntity(): boolean {
        return (
            !this.chart.isScatter &&
            this.chart.addCountryMode === "change-country" &&
            this.availableEntities.length > 1
        )
    }

    @computed.struct get availableKeys(): EntityDimensionKey[] {
        return sortBy([...Array.from(this.entityDimensionMap.keys())])
    }

    @computed.struct get remainingKeys(): EntityDimensionKey[] {
        const { availableKeys, selectedKeys } = this
        return without(availableKeys, ...selectedKeys)
    }

    @computed get availableKeysByEntity(): Map<string, EntityDimensionKey[]> {
        const keysByEntity = new Map()
        this.entityDimensionMap.forEach((info, key) => {
            const keys = keysByEntity.get(info.entity) || []
            keys.push(key)
            keysByEntity.set(info.entity, keys)
        })
        return keysByEntity
    }

    lookupKey(key: EntityDimensionKey) {
        const keyDatum = this.entityDimensionMap.get(key)
        if (keyDatum !== undefined) return keyDatum
        else throw new Error(`Unknown data key: ${key}`)
    }

    getLabelForKey(key: EntityDimensionKey): string {
        return this.lookupKey(key).label
    }

    getAnnotationForKey(key: EntityDimensionKey): string {
        return this.lookupKey(key).annotation || ""
    }

    toggleKey(key: EntityDimensionKey) {
        if (includes(this.selectedKeys, key)) {
            this.selectedKeys = this.selectedKeys.filter(k => k !== key)
        } else {
            this.selectedKeys = this.selectedKeys.concat([key])
        }
    }

    @computed get primaryVariable() {
        const yDimension = find(this.chart.dimensions, { property: "y" })
        return yDimension
            ? this.chart.variablesById[yDimension.variableId]
            : undefined
    }

    @computed get sourcesWithDimension(): SourceWithDimension[] {
        const { filledDimensions } = this

        const sources: SourceWithDimension[] = []
        each(filledDimensions, dim => {
            const { variable } = dim
            // HACK (Mispy): Ignore the default color source on scatterplots.
            if (
                variable.name !== "Countries Continents" &&
                variable.name !== "Total population (Gapminder)"
            )
                sources.push({ source: variable.source, dimension: dim })
        })
        return sources
    }

    @computed get json() {
        return toJS({
            availableEntities: this.availableEntitiesToReader
        })
    }
}
