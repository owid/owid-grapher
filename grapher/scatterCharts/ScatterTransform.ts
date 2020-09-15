import {
    isEmpty,
    intersection,
    keyBy,
    isNumber,
    has,
    groupBy,
    map,
    sortedFindClosestIndex,
    firstOfNonEmptyArray,
    lastOfNonEmptyArray,
    uniq,
    compact,
    formatYear,
    flatten,
    defaultTo,
    first,
    last,
    formatValue,
    domainExtent,
    identity,
    minBy,
    sortNumeric,
    lowerCaseFirstLetterUnlessAbbreviation,
    cagr,
    relativeMinAndMax,
} from "grapher/utils/Util"
import { computed } from "mobx"
import { ChartDimension } from "grapher/chart/ChartDimension"
import { ScatterSeries, ScatterValue } from "./PointsWithLabels"
import { ChartTransform } from "grapher/chart/ChartTransform"
import {
    EntityDimensionKey,
    ScaleType,
    Time,
} from "grapher/core/GrapherConstants"
import { ColorScale } from "grapher/color/ColorScale"
import { EntityName } from "owidTable/OwidTableConstants"

// Responsible for translating chart configuration into the form
// of a scatter plot
export class ScatterTransform extends ChartTransform {
    @computed get colorScale() {
        const that = this
        return new ColorScale({
            get config() {
                return that.grapher.colorScale
            },
            get defaultBaseColorScheme() {
                return "continents"
            },
            get sortedNumericValues() {
                return that.colorDimension?.sortedNumericValues ?? []
            },
            get categoricalValues() {
                return (
                    that.colorDimension?.column.sortedUniqNonEmptyStringVals ??
                    []
                )
            },
            get hasNoDataBin() {
                return !!(
                    that.colorDimension &&
                    that.allPoints.some((point) => point.color === undefined)
                )
            },
            get defaultNoDataColor() {
                return "#959595"
            },
            get formatNumericValueFn() {
                return that.colorDimension?.formatValueShortFn ?? identity
            },
        })
    }

    @computed get failMessage() {
        const { filledDimensions } = this.grapher
        if (!filledDimensions.some((d) => d.property === "y"))
            return "Missing Y axis variable"
        else if (!filledDimensions.some((d) => d.property === "x"))
            return "Missing X axis variable"
        else if (isEmpty(this.possibleEntityNames))
            return "No entities with data for both X and Y"
        else if (isEmpty(this.possibleDataTimes))
            return "No times with data for both X and Y"
        else if (isEmpty(this.currentData))
            return (
                "No matching data" +
                (this.grapher.isReady ? "" : ". Chart is not ready")
            )
        else return undefined
    }

    // Scatterplot should have exactly one dimension for each of x and y
    // The y dimension is treated as the "primary" variable
    @computed private get yDimension() {
        return this.grapher.filledDimensions.find((d) => d.property === "y")
    }
    @computed private get xDimension() {
        return this.grapher.filledDimensions.find((d) => d.property === "x")
    }
    @computed get colorDimension() {
        return this.grapher.filledDimensions.find((d) => d.property === "color")
    }

    // todo: remove this. Should be done as a simple column transform at the data level.
    // Possible to override the x axis dimension to target a special year
    // In case you want to graph say, education in the past and democracy today https://ourworldindata.org/grapher/correlation-between-education-and-democracy
    @computed get xOverrideTime() {
        return this.xDimension && this.xDimension.targetTime
    }

    set xOverrideTime(value: number | undefined) {
        this.xDimension!.targetTime = value
    }

    @computed get canToggleRelativeMode() {
        return (
            this.hasTimeline &&
            !this.grapher.hideRelativeToggle &&
            this.xOverrideTime === undefined
        )
    }

    // Unlike other charts, the scatterplot shows all available data by default, and the selection
    // is just for emphasis. But this behavior can be disabled.
    @computed private get hideBackgroundEntities() {
        return this.grapher.addCountryMode === "disabled"
    }
    @computed private get possibleEntityNames(): EntityName[] {
        const yEntities = this.yDimension ? this.yDimension.entityNamesUniq : []
        const xEntities = this.xDimension ? this.xDimension.entityNamesUniq : []
        return intersection(yEntities, xEntities)
    }

    // todo: remove
    @computed get selectableEntityDimensionKeys(): EntityDimensionKey[] {
        return this.currentData.map((series) => series.entityDimensionKey)
    }

    // todo: move to table
    @computed get excludedEntityNames(): EntityName[] {
        const entityIds = this.grapher.excludedEntities || []
        const entityNameMap = this.grapher.table.entityIdToNameMap
        return entityIds
            .map((entityId) => entityNameMap.get(entityId)!)
            .filter((d) => d)
    }

    // todo: remove. do this at table filter level
    getEntityNamesToShow(
        filterBackgroundEntities = this.hideBackgroundEntities
    ): EntityName[] {
        let entityNames = filterBackgroundEntities
            ? this.grapher.selectedEntityNames
            : this.possibleEntityNames

        if (this.grapher.matchingEntitiesOnly && this.colorDimension)
            entityNames = intersection(
                entityNames,
                this.colorDimension.entityNamesUniq
            )

        if (this.excludedEntityNames)
            entityNames = entityNames.filter(
                (entity) => !this.excludedEntityNames.includes(entity)
            )

        return entityNames
    }

    // The times for which there MAY be data on the scatterplot
    // Not all of these will necessarily end up on the timeline, because there may be no x/y entity overlap for that time
    // e.g. https://ourworldindata.org/grapher/life-expectancy-years-vs-real-gdp-per-capita-2011us
    @computed private get possibleDataTimes(): Time[] {
        const yDimensionTimes = this.yDimension ? this.yDimension.timesUniq : []
        const xDimensionTimes = this.xDimension ? this.xDimension.timesUniq : []

        if (this.xOverrideTime !== undefined) return yDimensionTimes
        else return intersection(yDimensionTimes, xDimensionTimes)
    }

    // The times for which we intend to calculate output data
    @computed private get timesToCalculate(): Time[] {
        return this.possibleDataTimes
    }

    @computed get compareEndPointsOnly() {
        return !!this.grapher.compareEndPointsOnly
    }

    set compareEndPointsOnly(value: boolean) {
        this.grapher.compareEndPointsOnly = value || undefined
    }

    // todo: move this sort of thing to OwidTable
    // todo: add unit tests for this thing
    // Precompute the data transformation for every timeline year (so later animation is fast)
    // If there's no timeline, this uses the same structure but only computes for a single year
    private getDataByEntityAndTime(
        entitiesToShow = this.getEntityNamesToShow()
    ): Map<EntityName, Map<Time, ScatterValue>> {
        const { filledDimensions } = this.grapher
        const validEntityLookup = keyBy(entitiesToShow)

        const dataByEntityAndTime = new Map<
            EntityName,
            Map<Time, ScatterValue>
        >()

        for (const dimension of filledDimensions) {
            // First, we organize the data by entity
            const initialDataByEntity = new Map<
                EntityName,
                { times: Time[]; values: (string | number)[] }
            >()
            const rows = dimension.column.rowsWithValue
            dimension.values.forEach((value, index) => {
                const row = rows[index]
                const time = row.year ?? row.day
                const entityName = row.entityName

                if (!validEntityLookup[entityName]) return
                if (
                    (dimension.property === "x" ||
                        dimension.property === "y") &&
                    !isNumber(value)
                )
                    return

                let byEntity = initialDataByEntity.get(entityName)
                if (!byEntity) {
                    byEntity = { times: [], values: [] }
                    initialDataByEntity.set(entityName, byEntity)
                }

                byEntity.times.push(time)
                byEntity.values.push(value)
            })

            this._useTolerance(
                dimension,
                dataByEntityAndTime,
                initialDataByEntity
            )
        }

        this._removeUnwantedPoints(dataByEntityAndTime)

        return dataByEntityAndTime
    }

    private _useTolerance(
        dimension: ChartDimension,
        dataByEntityAndTime: Map<EntityName, Map<Time, ScatterValue>>,
        initialDataByEntity: Map<
            EntityName,
            { times: Time[]; values: (string | number)[] }
        >
    ) {
        const { timesToCalculate, xOverrideTime } = this
        const tolerance =
            dimension.property === "size" ? Infinity : dimension.tolerance

        // Now go through each entity + timeline year and use a binary search to find the closest
        // matching data year within tolerance
        // NOTE: this code assumes years is sorted asc!!!
        initialDataByEntity.forEach((byEntity, entityName) => {
            let dataByYear = dataByEntityAndTime.get(entityName)
            if (dataByYear === undefined) {
                dataByYear = new Map<Time, ScatterValue>()
                dataByEntityAndTime.set(entityName, dataByYear)
            }

            for (const outputYear of timesToCalculate) {
                const targetYear =
                    xOverrideTime !== undefined && dimension.property === "x"
                        ? xOverrideTime
                        : outputYear
                const i = sortedFindClosestIndex(byEntity.times, targetYear)
                const year = byEntity.times[i]

                // Skip years that aren't within tolerance of the target
                if (
                    year < targetYear - tolerance ||
                    year > targetYear + tolerance
                ) {
                    continue
                }

                const value = byEntity.values[i]

                let point = dataByYear.get(outputYear)
                if (point === undefined) {
                    point = {
                        entityName,
                        year: outputYear,
                        time: {},
                    } as ScatterValue
                    dataByYear.set(outputYear, point)
                }

                ;(point as any).time[dimension.property] = year
                ;(point as any)[dimension.property] = value
            }
        })
    }

    private _removeUnwantedPoints(
        dataByEntityAndTime: Map<EntityName, Map<Time, ScatterValue>>
    ) {
        // The exclusion of points happens as a last step in order to avoid artefacts due to
        // the tolerance calculation. E.g. if we pre-filter the data based on the X and Y
        // domains before creating the points, the tolerance may lead to different X-Y
        // values being joined.
        // -@danielgavrilov, 2020-04-29
        const { yAxis, xAxis } = this.grapher
        dataByEntityAndTime.forEach((dataByTime) => {
            dataByTime.forEach((point, time) => {
                // Exclude any points with data for only one axis
                if (!has(point, "x") || !has(point, "y"))
                    dataByTime.delete(time)
                // Exclude points that go beyond min/max of X axis
                else if (xAxis.shouldRemovePoint(point.x))
                    dataByTime.delete(time)
                // Exclude points that go beyond min/max of Y axis
                else if (yAxis.shouldRemovePoint(point.y))
                    dataByTime.delete(time)
            })
        })
    }

    @computed get allPoints() {
        const allPoints: ScatterValue[] = []
        this.getDataByEntityAndTime().forEach((dataByTime) => {
            dataByTime.forEach((point) => {
                allPoints.push(point)
            })
        })
        return allPoints
    }

    // The selectable years that will end up on the timeline UI (if enabled)
    @computed get availableTimes(): Time[] {
        return this.allPoints.map((point) => point.year)
    }

    @computed private get currentValues() {
        return flatten(this.currentData.map((g) => g.values))
    }

    // domains across the entire timeline
    private domainDefault(property: "x" | "y"): [number, number] {
        const scaleType = property === "x" ? this.xScaleType : this.yScaleType
        if (!this.grapher.useTimelineDomains) {
            return domainExtent(
                this.pointsForAxisDomains.map((d) => d[property]),
                scaleType,
                this.grapher.zoomToSelection && this.selectedPoints.length
                    ? 1.1
                    : 1
            )
        }

        if (this.grapher.isRelativeMode)
            return relativeMinAndMax(this.allPoints, property)

        return domainExtent(
            this.allPoints.map((v) => v[property]),
            scaleType
        )
    }

    @computed private get xDomainDefault() {
        return this.domainDefault("x")
    }

    @computed private get selectedPoints() {
        const entitiesFor = new Set(this.getEntityNamesToShow(true))
        return this.allPoints.filter(
            (point) => point.entityName && entitiesFor.has(point.entityName)
        )
    }

    @computed private get pointsForAxisDomains() {
        if (!this.grapher.hasSelection || !this.grapher.zoomToSelection)
            return this.currentValues

        return this.selectedPoints.length
            ? this.selectedPoints
            : this.currentValues
    }

    @computed get sizeDomain(): [number, number] {
        const sizeValues: number[] = []
        this.allPoints.forEach((g) => g.size && sizeValues.push(g.size))
        if (sizeValues.length === 0) return [1, 100]
        else return domainExtent(sizeValues, ScaleType.linear)
    }

    @computed private get yScaleType() {
        return this.grapher.isRelativeMode
            ? ScaleType.linear
            : this.grapher.yAxis.scaleType || ScaleType.linear
    }

    @computed private get yAxisLabel() {
        return (
            this.grapher.yAxis.label ||
            (this.yDimension && this.yDimension.displayName) ||
            ""
        )
    }

    @computed private get yDomainDefault() {
        return this.domainDefault("y")
    }

    @computed get yAxis() {
        const { grapher, yDomainDefault, yDimension } = this

        const axis = grapher.yAxis.toVerticalAxis()
        axis.tickFormatFn =
            (yDimension && yDimension.formatValueShortFn) || axis.tickFormatFn

        const label = this.yAxisLabel

        axis.scaleType = this.yScaleType

        if (grapher.isRelativeMode) {
            axis.scaleTypeOptions = [ScaleType.linear]
            axis.domain = yDomainDefault // Overwrite user's min/max
            if (label && label.length > 1) {
                axis.label = `Average annual change in ${lowerCaseFirstLetterUnlessAbbreviation(
                    label
                )}`
            }
            axis.tickFormatFn = (v: number) => formatValue(v, { unit: "%" })
        } else {
            axis.updateDomainPreservingUserSettings(yDomainDefault)
            axis.label = label
        }

        return axis
    }

    @computed private get xScaleType() {
        return this.grapher.isRelativeMode
            ? ScaleType.linear
            : this.grapher.xAxis.scaleType || ScaleType.linear
    }

    @computed private get xAxisLabelBase() {
        const xDimName = this.xDimension && this.xDimension.displayName
        if (this.xOverrideTime !== undefined)
            return `${xDimName} in ${this.xOverrideTime}`
        return xDimName
    }

    @computed get xAxis() {
        const { xDomainDefault, xDimension, grapher, xAxisLabelBase } = this

        const { xAxis } = grapher

        const axis = xAxis.toHorizontalAxis()

        axis.scaleType = this.xScaleType
        if (grapher.isRelativeMode) {
            axis.scaleTypeOptions = [ScaleType.linear]
            axis.domain = xDomainDefault // Overwrite user's min/max
            const label = xAxis.label || xAxisLabelBase
            if (label && label.length > 1) {
                axis.label = `Average annual change in ${lowerCaseFirstLetterUnlessAbbreviation(
                    label
                )}`
            }
            axis.tickFormatFn = (v: number) => formatValue(v, { unit: "%" })
        } else {
            axis.updateDomainPreservingUserSettings(xDomainDefault)
            const label = xAxis.label || xAxisLabelBase
            if (label) axis.label = label
            axis.tickFormatFn =
                (xDimension && xDimension.formatValueShortFn) ||
                axis.tickFormatFn
        }

        return axis
    }

    @computed get yFormatTooltip(): (d: number) => string {
        return this.grapher.isRelativeMode || !this.yDimension
            ? this.yAxis.tickFormatFn
            : this.yDimension.formatValueLongFn
    }

    @computed get xFormatTooltip(): (d: number) => string {
        return this.grapher.isRelativeMode || !this.xDimension
            ? this.xAxis.tickFormatFn
            : this.xDimension.formatValueLongFn
    }

    @computed get yFormatYear(): (year: number) => string {
        return this.yDimension ? this.yDimension.formatTimeFn : formatYear
    }

    @computed get xFormatYear(): (year: number) => string {
        return this.xDimension ? this.xDimension.formatTimeFn : formatYear
    }

    // todo: add unit tests
    private _filterValues(
        values: ScatterValue[],
        startTime: Time,
        endTime: Time,
        yScaleType: ScaleType,
        xScaleType: ScaleType,
        isRelativeMode: boolean,
        xOverrideTime?: Time
    ) {
        // Only allow tolerance data to occur once in any given chart (no duplicate data points)
        // Prioritize the start and end years first, then the "true" year

        // NOTE: since groupBy() creates an object, the values may be reordered. we reorder a few lines below.
        values = map(
            groupBy(values, (v) => v.time.y),
            (vals: ScatterValue[]) =>
                minBy(vals, (v) =>
                    v.year === startTime || v.year === endTime
                        ? -Infinity
                        : Math.abs(v.year - v.time.y)
                ) as ScatterValue
        )

        if (xOverrideTime === undefined) {
            // NOTE: since groupBy() creates an object, the values may be reordered
            values = map(
                groupBy(values, (v) => v.time.x),
                (vals: ScatterValue[]) =>
                    minBy(vals, (v) =>
                        v.year === startTime || v.year === endTime
                            ? -Infinity
                            : Math.abs(v.year - v.time.x)
                    ) as ScatterValue
            )
        }

        // Sort values by year again in case groupBy() above reordered the values
        values = sortNumeric(values, (v) => v.year)

        // Don't allow values <= 0 for log scales
        if (yScaleType === ScaleType.log) values = values.filter((v) => v.y > 0)
        if (xScaleType === ScaleType.log) values = values.filter((v) => v.x > 0)

        // Don't allow values *equal* to zero for CAGR mode
        if (isRelativeMode)
            values = values.filter((v) => v.y !== 0 && v.x !== 0)

        return values
    }

    // todo: refactor/remove and/or add unit tests
    @computed get currentData() {
        if (!this.grapher.isReady) return []

        const {
            grapher,
            startTimelineTime,
            endTimelineTime,
            xScaleType,
            yScaleType,
            compareEndPointsOnly,
            xOverrideTime,
        } = this
        const { keyColors, isRelativeMode } = grapher
        let currentData: ScatterSeries[] = []

        // As needed, join the individual year data points together to create an "arrow chart"
        this.getDataByEntityAndTime().forEach((dataByTime, entityName) => {
            // Since scatterplots interrelate two variables via entity overlap, their entityDimensionKeys are solely entity-based
            const entityDimensionKey = grapher.makeEntityDimensionKey(
                entityName,
                0
            )

            const group = {
                entityDimensionKey,
                label: grapher.getLabelForKey(entityDimensionKey),
                color: "#932834", // Default color, used when no color dimension is present
                size: 0,
                values: [],
            } as ScatterSeries

            dataByTime.forEach((point, year) => {
                if (year < startTimelineTime || year > endTimelineTime) return
                group.values.push(point)
            })

            // Use most recent size and color values
            // const lastPoint = last(group.values)

            if (group.values.length) {
                const keyColor = keyColors[entityDimensionKey]
                if (keyColor !== undefined) {
                    group.color = keyColor
                } else if (this.colorDimension) {
                    const colorValue = last(group.values.map((v) => v.color))
                    const color = this.colorScale.getColor(colorValue)
                    if (color !== undefined) {
                        group.color = color
                        group.isScaleColor = true
                    }
                }
                const sizes = group.values.map((v) => v.size)
                group.size = defaultTo(
                    last(sizes.filter((s) => isNumber(s))),
                    0
                )
                currentData.push(group)
            }
        })

        currentData.forEach((series) => {
            series.values = this._filterValues(
                series.values,
                startTimelineTime,
                endTimelineTime,
                yScaleType,
                xScaleType,
                isRelativeMode,
                xOverrideTime
            )
        })

        currentData = currentData.filter((series) => {
            // No point trying to render series with no valid points!
            if (series.values.length === 0) return false

            // Hide lines which don't cover the full span
            if (this.grapher.hideLinesOutsideTolerance)
                return (
                    firstOfNonEmptyArray(series.values).year ===
                        startTimelineTime &&
                    lastOfNonEmptyArray(series.values).year === endTimelineTime
                )

            return true
        })

        if (compareEndPointsOnly) {
            currentData.forEach((series) => {
                const endPoints = [first(series.values), last(series.values)]
                series.values = compact(uniq(endPoints))
            })
        }

        if (isRelativeMode) {
            currentData.forEach((series) => {
                if (series.values.length === 0) return
                const startValue = firstOfNonEmptyArray(series.values)
                const endValue = lastOfNonEmptyArray(series.values)
                series.values = [
                    {
                        x: cagr(startValue, endValue, "x"),
                        y: cagr(startValue, endValue, "y"),
                        size: endValue.size,
                        year: endValue.year,
                        color: endValue.color,
                        time: {
                            y: endValue.time.y,
                            x: endValue.time.x,
                            span: [startValue.time.y, endValue.time.y],
                        },
                    },
                ]
            })
        }

        return currentData
    }
}
