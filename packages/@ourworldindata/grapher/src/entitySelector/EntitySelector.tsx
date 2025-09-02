import * as _ from "lodash-es"
import * as React from "react"
import { observer } from "mobx-react"
import {
    computed,
    action,
    reaction,
    when,
    IReactionDisposer,
    makeObservable,
} from "mobx"
import cx from "classnames"
import a from "indefinite"
import {
    isTouchDevice,
    SortOrder,
    isFiniteWithGuard,
    CoreValueType,
    getUserCountryInformation,
    regions,
    Tippy,
    excludeUndefined,
    FuzzySearch,
    getUserNavigatorLanguagesNonEnglish,
    getRegionAlternativeNames,
    convertDaysSinceEpochToDate,
    checkIsOwidIncomeGroupName,
    checkHasMembers,
    Region,
    getRegionByName,
    makeSafeForCSS,
} from "@ourworldindata/utils"
import {
    Checkbox,
    RadioButton,
    OverlayHeader,
} from "@ourworldindata/components"
import {
    faLocationArrow,
    faArrowRightArrowLeft,
    faFilter,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { SelectionArray } from "../selection/SelectionArray"
import { Flipper, Flipped } from "react-flip-toolkit"
import {
    combineHistoricalAndProjectionColumns,
    makeSelectionArray,
} from "../chart/ChartUtils.js"
import {
    DEFAULT_GRAPHER_ENTITY_TYPE,
    DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
    POPULATION_INDICATOR_ID_USED_IN_ENTITY_SELECTOR,
    GDP_PER_CAPITA_INDICATOR_ID_USED_IN_ENTITY_SELECTOR,
    isPopulationVariableETLPath,
    isWorldEntityName,
} from "../core/GrapherConstants"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { SortIcon } from "../controls/SortIcon"
import { Dropdown } from "../controls/Dropdown"
import { scaleLinear, type ScaleLinear } from "d3-scale"
import {
    AdditionalGrapherDataFetchFn,
    ColumnSlug,
    EntityName,
    OwidColumnDef,
    ProjectionColumnInfo,
    Time,
    ToleranceStrategy,
} from "@ourworldindata/types"
import { buildVariableTable } from "../core/LegacyToOwidTable"
import { DrawerContext } from "../slideInDrawer/SlideInDrawer.js"
import * as R from "remeda"
import { MapConfig } from "../mapCharts/MapConfig"
import { EntitySelectorEvent } from "../core/GrapherAnalytics"
import { match } from "ts-pattern"
import {
    entityRegionTypeLabels,
    EntityNamesByRegionType,
    EntityRegionType,
    EntityRegionTypeGroup,
    isAggregateSource,
} from "../core/EntitiesByRegionType"
import { SearchField } from "../controls/SearchField"

export type CoreColumnBySlug = Record<ColumnSlug, CoreColumn>

type EntityFilter = EntityRegionType | "all"

type ValueBySlugAndTimeAndEntityName<T> = Map<
    ColumnSlug,
    Map<Time, Map<EntityName, T>>
>

export interface EntitySelectorState {
    searchInput: string
    sortConfig: SortConfig
    entityFilter: EntityFilter
    localEntityNames?: string[]
    interpolatedSortColumnsBySlug?: CoreColumnBySlug
    isProjectionBySlugAndTimeAndEntityName?: ValueBySlugAndTimeAndEntityName<boolean>
    isLoadingExternalSortColumn?: boolean
}

export interface EntitySelectorManager {
    entitySelectorState: Partial<EntitySelectorState>
    tableForSelection: OwidTable
    selection: SelectionArray
    entityType?: string
    entityTypePlural?: string
    activeColumnSlugs?: string[]
    isEntitySelectorModalOrDrawerOpen?: boolean
    canChangeEntity?: boolean
    canHighlightEntities?: boolean
    endTime?: Time
    isOnMapTab?: boolean
    mapConfig?: MapConfig
    mapColumnSlug?: ColumnSlug
    isEntityMutedInSelector?: (entityName: EntityName) => boolean
    onSelectEntity?: (entityName: EntityName) => void
    onDeselectEntity?: (entityName: EntityName) => void
    onClearEntities?: () => void
    yColumnSlugs?: ColumnSlug[]
    entityRegionTypeGroups?: EntityRegionTypeGroup[]
    entityNamesByRegionType?: EntityNamesByRegionType
    isReady?: boolean
    logEntitySelectorEvent: (
        action: EntitySelectorEvent,
        target?: string
    ) => void
    additionalDataLoaderFn?: AdditionalGrapherDataFetchFn
    projectionColumnInfoBySlug?: Map<ColumnSlug, ProjectionColumnInfo>
}

interface SortConfig {
    slug: ColumnSlug
    order: SortOrder
}

type SearchableEntity = {
    name: string
    sortColumnValues: Record<ColumnSlug, CoreValueType | undefined>
    isLocal?: boolean
    alternativeNames?: string[]
    regionInfo?: Region
}

interface SortDropdownOption {
    type:
        | "name" // sorted by name
        | "chart-indicator" // sorted by chart column
        | "external-indicator" // sorted by an external indicator
    value: string // slug
    slug: string
    label: string
    formattedTime?: string
    trackNote?: string // unused
}

interface FilterDropdownOption {
    value: EntityFilter
    label: string
    count: number
    trackNote?: string // unused
}

const EXTERNAL_SORT_INDICATOR_DEFINITIONS = [
    {
        key: "population",
        label: "Population",
        indicatorId: POPULATION_INDICATOR_ID_USED_IN_ENTITY_SELECTOR,
        slug: indicatorIdToSlug(
            POPULATION_INDICATOR_ID_USED_IN_ENTITY_SELECTOR
        ),
        // checks if a column has population data
        isMatch: (column: CoreColumn): boolean => {
            // check the slug first
            const externalSlug = indicatorIdToSlug(
                POPULATION_INDICATOR_ID_USED_IN_ENTITY_SELECTOR
            )
            if (column.slug === externalSlug) return true

            // then check the catalog path
            return isPopulationVariableETLPath(
                (column.def as OwidColumnDef)?.catalogPath ?? ""
            )
        },
    },
    {
        key: "gdpPerCapita",
        label: "GDP per capita (int. $)",
        indicatorId: GDP_PER_CAPITA_INDICATOR_ID_USED_IN_ENTITY_SELECTOR,
        slug: indicatorIdToSlug(
            GDP_PER_CAPITA_INDICATOR_ID_USED_IN_ENTITY_SELECTOR
        ),
        // checks if a column has GDP per capita data
        isMatch: (column: CoreColumn): boolean => {
            // check the slug first
            const externalSlug = indicatorIdToSlug(
                GDP_PER_CAPITA_INDICATOR_ID_USED_IN_ENTITY_SELECTOR
            )
            if (column.slug === externalSlug) return true

            // then check the label
            const label = getTitleForSortColumnLabel(column)
            // matches "gdp per capita" and content within parentheses
            const potentialMatches =
                label.match(/\(.*?\)|(\bgdp per capita\b)/gi) ?? []
            // filter for "gdp per capita" matches that are not within parentheses
            const matches = potentialMatches.filter(
                (match) => !match.includes("(")
            )

            return matches.length > 0
        },
    },
] as const

type ExternalSortIndicatorDefinition =
    (typeof EXTERNAL_SORT_INDICATOR_DEFINITIONS)[number]
type ExternalSortIndicatorKey = ExternalSortIndicatorDefinition["key"]

const regionNamesSet = new Set(regions.map((region) => region.name))

interface EntitySelectorProps {
    manager: EntitySelectorManager
    selection?: SelectionArray
    autoFocus?: boolean
    onDismiss?: () => void
}

@observer
export class EntitySelector extends React.Component<EntitySelectorProps> {
    static override contextType = DrawerContext
    declare context: React.ContextType<typeof DrawerContext>

    scrollableContainer = React.createRef<HTMLDivElement>()
    searchFieldRef = React.createRef<HTMLInputElement>()
    contentRef = React.createRef<HTMLDivElement>()

    private sortConfigByName: SortConfig = {
        slug: this.table.entityNameSlug,
        order: SortOrder.asc,
    }

    private disposers: IReactionDisposer[] = []

    constructor(props: EntitySelectorProps) {
        super(props)
        makeObservable(this)
    }

    override componentDidMount(): void {
        void this.populateLocalEntities()

        if (this.props.autoFocus && !isTouchDevice())
            this.searchFieldRef.current?.focus()

        // scroll to the top when the search input changes
        this.disposers.push(
            reaction(
                () => this.searchInput,
                () => {
                    if (this.scrollableContainer.current)
                        this.scrollableContainer.current.scrollTop = 0
                }
            )
        )

        // the initial sorting strategy depends on data,
        // which is why we wait for Grapher to be ready
        this.disposers.push(
            when(
                () => !!this.manager.isReady,
                () => this.initSortConfig()
            )
        )

        // Mdims and explorers can change the columns available for sorting, and
        // we need to change the sort config accordingly
        this.disposers.push(
            reaction(
                () => this.sortOptions,
                () => this.updateSortConfigIfOptionHasBecomeUnavailable()
            )
        )
    }

    override componentWillUnmount(): void {
        if (this.timeoutId) clearTimeout(this.timeoutId)
        this.disposers.forEach((dispose) => dispose())
    }

    private set(newState: Partial<EntitySelectorState>): void {
        const correctedState = { ...newState }

        if (newState.sortConfig !== undefined) {
            const correctedSortConfig = { ...newState.sortConfig }

            const shouldBeSortedByName =
                newState.sortConfig.slug === this.table.entityNameSlug

            // sort names in ascending order by default
            if (shouldBeSortedByName && !this.isSortedByName) {
                correctedSortConfig.order = SortOrder.asc
            }

            // sort values in descending order by default
            if (!shouldBeSortedByName && this.isSortedByName) {
                correctedSortConfig.order = SortOrder.desc
            }

            correctedState.sortConfig = correctedSortConfig
        }

        this.manager.entitySelectorState = {
            ...this.manager.entitySelectorState,
            ...correctedState,
        }
    }

    getDefaultSortConfig(): SortConfig {
        const chartIndicatorSortOptions = this.sortOptions.filter(
            (option) => option.type === "chart-indicator"
        )

        // default to sorting by the first chart column if there is only one
        if (chartIndicatorSortOptions.length === 1) {
            const { slug } = chartIndicatorSortOptions[0]
            this.setInterpolatedSortColumnBySlug(slug)
            return { slug, order: SortOrder.desc }
        }

        return this.sortConfigByName
    }

    updateSortConfigIfOptionHasBecomeUnavailable() {
        // We don't want to update the sort config when `sortOptions` are not ready,
        // because the new chart dimensions are currently loading
        if (!this.manager.isReady) return
        if (!this.manager.activeColumnSlugs?.length) return

        // Check whether the current sort option is still available in the newly-updated
        // sortOptions
        if (
            !this.sortOptions.find(
                (option) => option.slug === this.sortConfig.slug
            )
        ) {
            this.set({ sortConfig: this.getDefaultSortConfig() })
        }
    }

    initSortConfig(): void {
        this.set({ sortConfig: this.getDefaultSortConfig() })
    }

    resetInterpolatedMapColumn(): void {
        const { mapColumnSlug } = this.manager
        const sortSlug = this.sortConfig.slug

        // no need to reset the map column slug if it doesn't exist or isn't set
        if (
            !mapColumnSlug ||
            !this.interpolatedSortColumnsBySlug[mapColumnSlug]
        )
            return

        if (sortSlug === mapColumnSlug) {
            // if the map column slug is currently selected, re-calculate its
            // tolerance because the map and chart tab might have different
            // tolerance settings
            this.setInterpolatedSortColumn(
                this.interpolateSortColumn(mapColumnSlug)
            )
        } else {
            // otherwise, delete it and it will be re-calculated when necessary
            delete this.manager.entitySelectorState
                .interpolatedSortColumnsBySlug?.[mapColumnSlug]
        }
    }

    @action.bound async populateLocalEntities(): Promise<void> {
        try {
            const localCountryInfo = await getUserCountryInformation()
            if (!localCountryInfo) return

            const countryRegionsWithoutIncomeGroups = localCountryInfo.regions
                ? localCountryInfo.regions.filter(
                      (region) => !checkIsOwidIncomeGroupName(region)
                  )
                : []

            const userEntityCodes = [
                localCountryInfo.code,
                ...countryRegionsWithoutIncomeGroups,
            ]

            const userRegions = regions.filter((region) =>
                userEntityCodes.includes(region.code)
            )

            const sortedUserRegions = _.sortBy(userRegions, (region) =>
                userEntityCodes.indexOf(region.code)
            )

            const localEntityNames = sortedUserRegions.map(
                (region) => region.name
            )

            if (localEntityNames) this.set({ localEntityNames })
        } catch {
            // ignore
        }
    }

    private setInterpolatedSortColumn(column: CoreColumn): void {
        this.set({
            interpolatedSortColumnsBySlug: {
                ...this.interpolatedSortColumnsBySlug,
                [column.slug]: column,
            },
        })
    }

    private setIsProjectionForSlug(
        slug: ColumnSlug,
        valuesByTimeAndEntityName: Map<Time, Map<EntityName, boolean>>
    ): void {
        const { isProjectionBySlugAndTimeAndEntityName } = this
        isProjectionBySlugAndTimeAndEntityName.set(
            slug,
            valuesByTimeAndEntityName
        )
        this.set({ isProjectionBySlugAndTimeAndEntityName })
    }

    @computed private get toleranceOverride(): {
        value?: number
        strategy?: ToleranceStrategy
    } {
        // use map tolerance if on the map tab
        const tolerance = this.manager.isOnMapTab
            ? this.manager.mapConfig?.timeTolerance
            : undefined
        const toleranceStrategy = this.manager.isOnMapTab
            ? this.manager.mapConfig?.toleranceStrategy
            : undefined

        return { value: tolerance, strategy: toleranceStrategy }
    }

    private interpolateSortColumn(slug: ColumnSlug): CoreColumn {
        return this.table
            .interpolateColumnWithTolerance(
                slug,
                this.toleranceOverride.value,
                this.toleranceOverride.strategy
            )
            .get(slug)
    }

    private interpolateAndCombineSortColumns(
        info: ProjectionColumnInfo
    ): OwidTable {
        const { projectedSlug, historicalSlug } = info

        // Interpolate the historical and projected columns separately
        const table = this.table
            .interpolateColumnWithTolerance(
                historicalSlug,
                this.toleranceOverride.value,
                this.toleranceOverride.strategy
            )
            .interpolateColumnWithTolerance(
                projectedSlug,
                this.toleranceOverride.value,
                this.toleranceOverride.strategy
            )

        // Combine the interpolated columns
        return combineHistoricalAndProjectionColumns(table, info, {
            shouldAddIsProjectionColumn: true,
        })
    }

    private setInterpolatedSortColumnBySlug(slug: ColumnSlug): void {
        if (this.interpolatedSortColumnsBySlug[slug]) return

        // If the column is a projection and has an historical counterpart,
        // then combine the projected and historical data into a single column
        const projectionInfo = this.projectionColumnInfoByCombinedSlug.get(slug)
        if (projectionInfo) {
            const table = this.interpolateAndCombineSortColumns(projectionInfo)

            const combinedColumn = table.get(projectionInfo.combinedSlug)
            const isProjectionValues = table.get(
                projectionInfo.slugForIsProjectionColumn
            ).valueByTimeAndEntityName

            this.setInterpolatedSortColumn(combinedColumn)
            this.setIsProjectionForSlug(
                projectionInfo.combinedSlug,
                isProjectionValues
            )

            return
        }

        const column = this.interpolateSortColumn(slug)
        this.setInterpolatedSortColumn(column)
    }

    private clearSearchInput(): void {
        this.set({ searchInput: "" })
    }

    private resetEntityFilter(): void {
        this.set({ entityFilter: undefined })
    }

    private updateSortSlug(newSlug: ColumnSlug) {
        this.set({
            sortConfig: {
                slug: newSlug,
                order: this.sortConfig.order,
            },
        })
    }

    private toggleSortOrder() {
        const newOrder =
            this.sortConfig.order === SortOrder.asc
                ? SortOrder.desc
                : SortOrder.asc
        this.set({
            sortConfig: {
                slug: this.sortConfig.slug,
                order: newOrder,
            },
        })
    }

    @computed private get chartHasDailyData(): boolean {
        return this.numericalChartColumns.some(
            (column) => column.display?.yearIsDay
        )
    }

    /**
     * Converts the given time to be compatible with the time format
     * of the given column.
     *
     * This is necessary for external sort indicators when they're loaded
     * for charts with daily data.
     */
    private toColumnCompatibleTime(time: Time, column: CoreColumn): Time {
        const isExternal = this.externalSortIndicatorDefinitions.some(
            (external) => column.slug === external.slug
        )

        // if the column comes from the chart, no conversion is needed
        if (!isExternal) return time

        // assumes that external indicators have yearly data
        const year = this.chartHasDailyData
            ? convertDaysSinceEpochToDate(time).year()
            : time

        // clamping is necessary since external indicators might not cover
        // the entire time range of the chart
        return R.clamp(year, { min: column.minTime, max: column.maxTime })
    }

    private formatTimeForSortColumnLabel(
        time: Time,
        column: CoreColumn
    ): string {
        const compatibleTime = this.toColumnCompatibleTime(time, column)
        return column.formatTime(compatibleTime)
    }

    @computed private get manager(): EntitySelectorManager {
        return this.props.manager
    }

    @computed private get endTime(): Time {
        return this.manager.endTime ?? this.table.maxTime!
    }

    @computed private get yColumnSlugs(): ColumnSlug[] {
        return this.manager.yColumnSlugs ?? []
    }

    private isEntityMuted(entityName: EntityName): boolean {
        return this.manager.isEntityMutedInSelector?.(entityName) ?? false
    }

    @computed private get title(): string {
        return this.manager.isOnMapTab
            ? `Select ${this.entityType.plural}`
            : this.manager.canHighlightEntities
              ? `Select ${this.entityType.plural}`
              : this.manager.canChangeEntity
                ? `Choose ${a(this.entityType.singular)}`
                : `Add/remove ${this.entityType.plural}`
    }

    @computed private get searchPlaceholderEntityType(): string {
        if (isAggregateSource(this.entityFilter)) return "region"

        return match(this.entityFilter)
            .with("all", () => this.entityType.singular)
            .with("countries", () => "country")
            .with("continents", () => "continent")
            .with("incomeGroups", () => "income group")
            .with("historicalCountries", () => "country or region")
            .exhaustive()
    }

    @computed private get searchInput(): string {
        return this.manager.entitySelectorState.searchInput ?? ""
    }

    @computed get sortConfig(): SortConfig {
        return (
            this.manager.entitySelectorState.sortConfig ?? this.sortConfigByName
        )
    }

    isSortSlugValid(slug: ColumnSlug): boolean {
        return this.sortOptions.some((option) => option.value === slug)
    }

    isEntityFilterValid(entityFilter: EntityFilter): boolean {
        return this.filterOptions.some(
            (option) => option.value === entityFilter
        )
    }

    @computed private get entityFilter(): EntityFilter {
        return (
            this.manager.entitySelectorState.entityFilter ??
            this.filterOptions[0]?.value ??
            "all"
        )
    }

    @computed private get localEntityNames(): string[] | undefined {
        return this.manager.entitySelectorState.localEntityNames
    }

    @computed private get interpolatedSortColumnsBySlug(): CoreColumnBySlug {
        return (
            this.manager.entitySelectorState.interpolatedSortColumnsBySlug ?? {}
        )
    }

    @computed
    private get isProjectionBySlugAndTimeAndEntityName(): ValueBySlugAndTimeAndEntityName<boolean> {
        return (
            this.manager.entitySelectorState
                .isProjectionBySlugAndTimeAndEntityName ?? new Map()
        )
    }

    @computed private get interpolatedSortColumns(): CoreColumn[] {
        return Object.values(this.interpolatedSortColumnsBySlug)
    }

    @computed private get isLoadingExternalSortColumn(): boolean {
        return (
            this.manager.entitySelectorState.isLoadingExternalSortColumn ??
            false
        )
    }

    @computed private get table(): OwidTable {
        return this.manager.tableForSelection
    }

    @computed private get someEntitiesAreRegions(): boolean {
        if (!this.entitiesAreCountriesOrRegions) return false
        return this.availableEntities.some((entity) =>
            checkHasMembers(entity.regionInfo)
        )
    }

    @computed private get entitiesAreCountriesOrRegions(): boolean {
        // Ignore the World entity since we have charts that only have the
        // World entity but no other countries or regions (e.g. 'World',
        // 'Northern Hemisphere' and 'Southern hemisphere')
        return this.availableEntityNames.some(
            (entityName) =>
                regionNamesSet.has(entityName) && !isWorldEntityName(entityName)
        )
    }

    @computed private get supportsSortingByExternalIndicators(): boolean {
        // If we can't dynamically load variables, don't ever the option to sort
        // by external indicators
        if (!this.manager.additionalDataLoaderFn) return false

        // Adding external indicators like population and gdp per capita
        // only makes sense for charts with countries or regions
        return this.entitiesAreCountriesOrRegions
    }

    @computed private get numericalChartColumns(): CoreColumn[] {
        const {
            activeColumnSlugs = [],
            mapColumnSlug,
            isOnMapTab,
        } = this.manager

        const activeSlugs = isOnMapTab ? [mapColumnSlug] : activeColumnSlugs

        return activeSlugs
            .map((slug) => this.table.get(slug))
            .filter((column) => column.hasNumberFormatting)
    }

    /**
     * Map of chart columns that match external sort indicators.
     * For example, if the chart has a column with population data,
     * it will be used instead of the "Population" external indicator.
     */
    @computed
    private get chartColumnsByExternalSortIndicatorKey(): Partial<
        Record<ExternalSortIndicatorKey, CoreColumn>
    > {
        const matchingColumns: Partial<
            Record<ExternalSortIndicatorKey, CoreColumn>
        > = {}
        for (const external of EXTERNAL_SORT_INDICATOR_DEFINITIONS) {
            const matchingColumn = this.numericalChartColumns.find((column) =>
                external.isMatch(column)
            )
            if (matchingColumn) matchingColumns[external.key] = matchingColumn
        }
        return matchingColumns
    }

    @computed
    private get externalSortIndicatorDefinitions(): ExternalSortIndicatorDefinition[] {
        if (!this.supportsSortingByExternalIndicators) return []

        // if the chart has a column that matches an external sort indicator,
        // prefer the chart column over the external indicator
        const matchingKeys = Object.keys(
            this.chartColumnsByExternalSortIndicatorKey
        )
        return EXTERNAL_SORT_INDICATOR_DEFINITIONS.filter(
            (external) => !matchingKeys.includes(external.key)
        )
    }

    @computed private get projectionColumnInfoByCombinedSlug(): Map<
        ColumnSlug,
        ProjectionColumnInfo
    > {
        if (!this.manager.projectionColumnInfoBySlug) return new Map()

        const projectionColumnInfoByCombinedSlug: Map<
            ColumnSlug,
            ProjectionColumnInfo
        > = new Map()

        for (const info of this.manager.projectionColumnInfoBySlug.values()) {
            projectionColumnInfoByCombinedSlug.set(info.combinedSlug, info)
        }

        return projectionColumnInfoByCombinedSlug
    }

    private combinedColumnHasHistoricalDataForTime(
        slug: ColumnSlug,
        time: Time
    ): boolean | null {
        const isProjectionByTimeAndEntityName =
            this.isProjectionBySlugAndTimeAndEntityName.get(slug)

        // We don't have data and thus can't make a decision
        if (!isProjectionByTimeAndEntityName) return null

        const values = isProjectionByTimeAndEntityName.get(time)?.values() ?? []
        return Array.from(values)?.some((isProjection) => !isProjection)
    }

    private makeSortColumnLabelForCombinedColumn(
        info: ProjectionColumnInfo,
        time: Time
    ): string {
        const { table, isProjectionBySlugAndTimeAndEntityName } = this

        const projectedLabel = getTitleForSortColumnLabel(
            table.get(info.projectedSlug)
        )
        const historicalLabel = getTitleForSortColumnLabel(
            table.get(info.historicalSlug)
        )

        const hasHistoricalDataForTime =
            this.combinedColumnHasHistoricalDataForTime(info.combinedSlug, time)

        // If the data for this column hasn't been computed yet, we can't
        // determine if it has historical data, and thus which label to show.
        // As a workaround, we check if any other (arbitrary) combined column
        // has historical data for this time point, based on the assumption that
        // projection columns typically share the same cut-off time.
        if (hasHistoricalDataForTime === null) {
            const arbitrarySlug = isProjectionBySlugAndTimeAndEntityName
                .keys()
                .next().value

            if (arbitrarySlug) {
                const hasHistoricalValues =
                    this.combinedColumnHasHistoricalDataForTime(
                        arbitrarySlug,
                        time
                    )
                return hasHistoricalValues ? historicalLabel : projectedLabel
            }

            return projectedLabel
        }

        // If there is any historical value for the given time,
        // we choose to show the label of the historical column
        return hasHistoricalDataForTime ? historicalLabel : projectedLabel
    }

    @computed get sortOptions(): SortDropdownOption[] {
        let options: SortDropdownOption[] = []

        // the first dropdown option is always the entity name
        options.push({
            type: "name",
            value: this.table.entityNameSlug,
            slug: this.table.entityNameSlug,
            label: "Name",
        })

        // add external indicators as sort options if applicable
        if (this.supportsSortingByExternalIndicators) {
            EXTERNAL_SORT_INDICATOR_DEFINITIONS.forEach((external) => {
                // if the chart has a column that matches the external
                // indicator, prefer it over the external indicator
                const chartColumn =
                    this.chartColumnsByExternalSortIndicatorKey[external.key]

                if (chartColumn) {
                    options.push({
                        type: "chart-indicator",
                        value: chartColumn.slug,
                        slug: chartColumn.slug,
                        label: getTitleForSortColumnLabel(chartColumn),
                        formattedTime: this.formatTimeForSortColumnLabel(
                            this.endTime,
                            chartColumn
                        ),
                    })
                } else {
                    const column =
                        this.interpolatedSortColumnsBySlug[external.slug]
                    options.push({
                        type: "external-indicator",
                        value: external.slug,
                        slug: external.slug,
                        label: external.label,
                        formattedTime: column
                            ? this.formatTimeForSortColumnLabel(
                                  this.endTime,
                                  column
                              )
                            : undefined,
                    })
                }
            })
        }

        // add the remaining numerical chart columns as sort options,
        // excluding columns that match external indicators (since those
        // have already been added)
        const matchingSlugs = Object.values(
            this.chartColumnsByExternalSortIndicatorKey
        ).map((column) => column.slug)
        const columns = this.numericalChartColumns.filter(
            (column) => !matchingSlugs.includes(column.slug)
        )

        // If we add data columns that combine historical and projected data,
        // then we want to exclude the individual columns from the sort options
        const slugsToExclude: Set<ColumnSlug> = new Set()

        for (const column of columns) {
            const formattedTime = this.formatTimeForSortColumnLabel(
                this.endTime,
                column
            )

            const projectionInfo = this.manager.projectionColumnInfoBySlug?.get(
                column.slug
            )

            // Combine projected and historical data
            if (projectionInfo) {
                const time = this.toColumnCompatibleTime(this.endTime, column)
                const label = this.makeSortColumnLabelForCombinedColumn(
                    projectionInfo,
                    time
                )

                options.push({
                    type: "chart-indicator",
                    value: projectionInfo.combinedSlug,
                    slug: projectionInfo.combinedSlug,
                    label,
                    formattedTime,
                })

                // We don't need a separate option for the historical data
                // if it's part of the projection series
                slugsToExclude.add(projectionInfo.historicalSlug)
            } else {
                options.push({
                    type: "chart-indicator",
                    value: column.slug,
                    slug: column.slug,
                    label: getTitleForSortColumnLabel(column),
                    formattedTime,
                })
            }
        }

        options = options.filter((option) => !slugsToExclude.has(option.value))

        return options
    }

    @computed get sortValue(): SortDropdownOption | null {
        return (
            this.sortOptions.find(
                (option) => option.slug === this.sortConfig.slug
            ) ?? null
        )
    }

    private isEntityNameSlug(slug: ColumnSlug): boolean {
        return slug === this.table.entityNameSlug
    }

    @computed private get isSortedByName(): boolean {
        return this.isEntityNameSlug(this.sortConfig.slug)
    }

    @computed private get entityType(): { singular: string; plural: string } {
        const entitiesAreCountriesOrRegions =
            this.manager.isOnMapTab ||
            (!this.manager.entityType && this.entitiesAreCountriesOrRegions)

        if (entitiesAreCountriesOrRegions)
            return this.someEntitiesAreRegions
                ? {
                      singular: "country or region",
                      plural: "countries and regions",
                  }
                : { singular: "country", plural: "countries" }

        return {
            singular: this.manager.entityType ?? DEFAULT_GRAPHER_ENTITY_TYPE,
            plural:
                this.manager.entityTypePlural ??
                DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
        }
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(
            this.props.selection ?? this.manager.selection
        )
    }

    @computed private get allEntitiesSelected(): boolean {
        return (
            this.selectionArray.numSelectedEntities ===
            this.availableEntityNames.length
        )
    }

    @computed private get availableEntityNames(): string[] {
        return this.table.availableEntityNames
    }

    @computed private get availableEntityNameSet(): Set<string> {
        return this.table.availableEntityNameSet
    }

    @computed private get availableEntities(): SearchableEntity[] {
        const langs = getUserNavigatorLanguagesNonEnglish()

        return this.availableEntityNames.map((entityName) => {
            const searchableEntity: SearchableEntity = {
                name: entityName,
                sortColumnValues: {},
                alternativeNames: getRegionAlternativeNames(entityName, langs),
                regionInfo: getRegionByName(entityName),
            }

            if (this.localEntityNames) {
                searchableEntity.isLocal =
                    this.localEntityNames.includes(entityName)
            }

            for (const column of this.interpolatedSortColumns) {
                const time = this.toColumnCompatibleTime(this.endTime, column)

                // If we're dealing with a mixed column that has historical and
                // projected data for the given time, then we choose not to
                // show projected data since the dropdown is labelled with the
                // display name of the historical column.
                const projectionInfo =
                    this.projectionColumnInfoByCombinedSlug.get(column.slug)
                if (projectionInfo) {
                    const isProjectedValue =
                        this.isProjectionBySlugAndTimeAndEntityName
                            ?.get(projectionInfo.combinedSlug)
                            ?.get(time)
                            ?.get(entityName)

                    if (isProjectedValue) {
                        const hasHistoricalValues =
                            this.combinedColumnHasHistoricalDataForTime(
                                projectionInfo.combinedSlug,
                                time
                            )
                        if (hasHistoricalValues) continue
                    }
                }

                const row = column.owidRowByEntityNameAndTime
                    .get(entityName)
                    ?.get(time)

                searchableEntity.sortColumnValues[column.slug] = row?.value
            }

            return searchableEntity
        })
    }

    @computed private get filteredAvailableEntities(): SearchableEntity[] {
        const { availableEntities, entityFilter } = this

        // Sort locals and maybe World to the top if we are looking at all entites
        if (entityFilter === "all")
            return this.sortEntities(availableEntities, {
                sortLocalsToTop: true,
            })

        const entityNameSet = new Set(
            this.manager.entityNamesByRegionType?.get(entityFilter) ?? []
        )
        const filteredAvailableEntities = availableEntities.filter((entity) =>
            entityNameSet.has(entity.name)
        )

        return this.sortEntities(filteredAvailableEntities, {
            // Sort locals and maybe World to the top if looking at the long countries list, not for others
            sortLocalsToTop: entityFilter === "countries",
        })
    }

    private sortEntities(
        entities: SearchableEntity[],
        options: { sortLocalsToTop: boolean } = {
            sortLocalsToTop: true,
        }
    ): SearchableEntity[] {
        const { sortConfig } = this
        const byName = (e: SearchableEntity) => e.name
        const byValue = (e: SearchableEntity) =>
            e.sortColumnValues[sortConfig.slug]

        // Name sorting
        if (this.isSortedByName) {
            // Simple name sort without local/world prioritization
            if (!options.sortLocalsToTop) {
                return _.orderBy(entities, byName, sortConfig.order)
            }

            // Name sort with locals on top and World between locals and others
            // We include "World" here (unlike when sorting by values, see notes below) because
            // here it is useful.
            const [[worldEntity], rest] = _.partition(entities, (e) =>
                isWorldEntityName(e.name)
            )
            const [locals, others] = _.partition(rest, (e) => e.isLocal)

            const sortedLocals = _.sortBy(locals, (e) =>
                this.localEntityNames?.indexOf(e.name)
            )
            const sortedOthers = _.orderBy(others, byName, sortConfig.order)

            return excludeUndefined([
                ...sortedLocals,
                worldEntity,
                ...sortedOthers,
            ])
        }

        // Value sorting: missing values go last
        const [withValues, withoutValues] = _.partition(entities, (e) =>
            isFiniteWithGuard(byValue(e))
        )

        let sortedWithValues: SearchableEntity[]
        if (options.sortLocalsToTop) {
            // We're not specially handling "World" here because we want to see the sorted
            // items and the user should understand that these are sorted. we already pull
            // up to three items (Germany, EU 27, Europe) up to the top and don't want to add
            // a fourth item in such cases that is obviously not sorted and that doesn't have
            // a "local" icon indicator
            const [localWith, otherWith] = _.partition(
                withValues,
                (e) => e.isLocal
            )

            // Locals: keep user-preferred order (by localEntityNames index)
            const sortedLocalWith = _.sortBy(localWith, (e) =>
                this.localEntityNames?.indexOf(e.name)
            )

            // Others: sort by value according to selected order
            const sortedOtherWith = _.orderBy(
                otherWith,
                byValue,
                sortConfig.order
            )

            sortedWithValues = excludeUndefined([
                ...sortedLocalWith,
                ...sortedOtherWith,
            ])
        } else {
            sortedWithValues = _.orderBy(withValues, byValue, sortConfig.order)
        }

        const sortedWithoutValues = _.orderBy(
            withoutValues,
            byName,
            SortOrder.asc
        )

        return [...sortedWithValues, ...sortedWithoutValues]
    }

    @computed get isMultiMode(): boolean {
        return !this.manager.canChangeEntity
    }

    @computed get fuzzy(): FuzzySearch<SearchableEntity> {
        return FuzzySearch.withKeyArray(
            this.filteredAvailableEntities,
            (entity) => [entity.name, ...(entity.alternativeNames ?? [])],
            (entity) => entity.name
        )
    }

    @computed get searchResults(): SearchableEntity[] | undefined {
        if (!this.searchInput) return undefined
        return this.fuzzy.search(this.searchInput)
    }

    @computed get selectedEntities(): SearchableEntity[] {
        const selected = this.availableEntities.filter((entity) =>
            this.isEntitySelected(entity)
        )
        return this.sortEntities(selected, { sortLocalsToTop: false })
    }

    @action.bound onTitleClick(): void {
        if (this.scrollableContainer.current)
            this.scrollableContainer.current.scrollTop = 0
    }

    @action.bound onSearchKeyDown(e: KeyboardEvent): void {
        const { searchResults } = this
        if (e.key === "Enter" && searchResults && searchResults.length > 0) {
            this.onChange(searchResults[0].name)
            this.clearSearchInput()
        }
    }

    @action.bound onDeselectEntities(entityNames: EntityName[]): void {
        for (const entityName of entityNames) {
            this.manager.onDeselectEntity?.(entityName)
        }
    }

    private timeoutId?: number
    @action.bound onChange(entityName: EntityName): void {
        if (this.isMultiMode) {
            this.selectionArray.toggleSelection(entityName)

            if (this.selectionArray.selectedSet.has(entityName)) {
                this.manager.onSelectEntity?.(entityName)
                this.manager.logEntitySelectorEvent?.("select", entityName)
            } else {
                this.manager.onDeselectEntity?.(entityName)
                this.manager.logEntitySelectorEvent?.("deselect", entityName)
            }

            if (this.selectionArray.numSelectedEntities === 0) {
                this.manager.onClearEntities?.()
            }
        } else {
            const dropEntityNames = this.selectionArray.selectedEntityNames
            this.selectionArray.setSelectedEntities([entityName])
            this.manager.onSelectEntity?.(entityName)
            this.manager.logEntitySelectorEvent?.("select", entityName)
            this.onDeselectEntities(dropEntityNames)

            // close the modal or drawer automatically after selection
            if (this.manager.isEntitySelectorModalOrDrawerOpen) {
                this.timeoutId = window.setTimeout(() => this.close(), 200)
            }
        }

        this.clearSearchInput()
    }

    @action.bound onClear(): void {
        const dropEntityNames = this.selectionArray.selectedEntityNames
        this.selectionArray.clearSelection()
        this.onDeselectEntities(dropEntityNames)
        this.manager.onClearEntities?.()

        this.resetEntityFilter()

        this.manager.logEntitySelectorEvent?.("clear")
    }

    @action.bound async loadAndSetExternalSortColumn(
        external: ExternalSortIndicatorDefinition
    ): Promise<void> {
        const { slug, indicatorId } = external
        const { additionalDataLoaderFn } = this.manager

        // the indicator has already been loaded
        if (this.interpolatedSortColumnsBySlug[slug]) return

        // load the external indicator
        try {
            this.set({ isLoadingExternalSortColumn: true })
            if (additionalDataLoaderFn === undefined)
                throw new Error(
                    "additionalDataLoaderFn is not set, can't load sort variables on demand"
                )
            const variable = await additionalDataLoaderFn(indicatorId)
            const variableTable = buildVariableTable(variable)
            const column = variableTable
                .filterByEntityNames(this.availableEntityNames)
                .interpolateColumnWithTolerance(slug, Infinity)
                .get(slug)
            if (column) this.setInterpolatedSortColumn(column)
        } catch {
            console.error(`Failed to load variable with id ${indicatorId}`)
        } finally {
            this.set({ isLoadingExternalSortColumn: false })
        }
    }

    @action.bound async onChangeSortSlug(
        selected: SortDropdownOption | null
    ): Promise<void> {
        if (selected) {
            const { slug } = selected

            // if an external indicator has been selected, load it
            const external = this.externalSortIndicatorDefinitions.find(
                (external) => external.slug === slug
            )
            if (external) await this.loadAndSetExternalSortColumn(external)

            // apply tolerance if an indicator is selected for the first time
            if (!external && !this.isEntityNameSlug(slug)) {
                this.setInterpolatedSortColumnBySlug(slug)
            }

            this.updateSortSlug(slug)

            const sortByTarget = this.isEntityNameSlug(slug)
                ? "name"
                : external
                  ? external.key
                  : "value"
            this.manager.logEntitySelectorEvent("sortBy", sortByTarget)
        }
    }

    @action.bound onChangeSortOrder(): void {
        this.toggleSortOrder()
        this.manager.logEntitySelectorEvent("sortOrder")
    }

    @action.bound private close(): void {
        // if rendered into a drawer, we use a method provided by the
        // `<SlideInDrawer />` component so that closing the drawer is animated
        if (this.context.toggleDrawerVisibility) {
            this.context.toggleDrawerVisibility()
        } else {
            this.manager.isEntitySelectorModalOrDrawerOpen = false
        }
    }

    @computed get filterOptions(): FilterDropdownOption[] {
        const { entityRegionTypeGroups = [] } = this.manager

        const options: FilterDropdownOption[] = entityRegionTypeGroups
            .map(({ regionType, entityNames }) => ({
                value: regionType,
                label: entityRegionTypeLabels[regionType],
                count: entityNames.filter((entityName) =>
                    this.availableEntityNameSet.has(entityName)
                ).length,
            }))
            .filter(({ count }) => count > 0)

        return [
            {
                value: "all",
                label: "All",
                count: this.availableEntities.length,
            },
            ...options,
        ]
    }

    @action.bound private onChangeEntityFilter(
        selected: FilterDropdownOption | null
    ): void {
        if (selected) {
            const option = selected
            this.set({ entityFilter: option.value })

            this.manager.logEntitySelectorEvent("filterBy", option.value)
        }
    }

    @computed private get filterValue(): FilterDropdownOption {
        return (
            this.filterOptions.find(
                (option) => option.value === this.entityFilter
            ) ?? this.filterOptions[0]
        )
    }

    @computed get shouldShowFilterBar(): boolean {
        return (
            this.filterOptions.length > 1 &&
            this.filterOptions[0].count !== this.filterOptions[1].count
        )
    }

    private renderFilterBar(): React.ReactElement {
        return (
            <div className="entity-selector__filter-bar">
                <Dropdown<FilterDropdownOption>
                    options={this.filterOptions}
                    onChange={this.onChangeEntityFilter}
                    value={this.filterValue}
                    formatOptionLabel={formatFilterOptionLabel}
                    aria-label="Filter by type"
                />
            </div>
        )
    }

    private renderSearchBar(): React.ReactElement {
        return (
            <div className="entity-selector__search-bar">
                <SearchField
                    ref={this.searchFieldRef}
                    value={this.searchInput}
                    onChange={(value) => this.set({ searchInput: value })}
                    onClear={() => this.clearSearchInput()}
                    placeholder={`Search for ${a(
                        this.searchPlaceholderEntityType
                    )}`}
                    trackNote="entity_selector_search"
                    onKeyDown={this.onSearchKeyDown}
                />
            </div>
        )
    }

    private renderSortBar(): React.ReactElement {
        return (
            <div className="entity-selector__sort-bar">
                <div className="entity-selector__sort-dropdown-and-button">
                    <Dropdown<SortDropdownOption>
                        className="entity-selector__sort-dropdown"
                        options={this.sortOptions}
                        onChange={this.onChangeSortSlug}
                        value={this.sortValue}
                        isLoading={this.isLoadingExternalSortColumn}
                        formatOptionLabel={formatSortOptionLabel}
                        aria-label="Sort by"
                    />
                    <button
                        type="button"
                        className="sort"
                        onClick={this.onChangeSortOrder}
                    >
                        <SortIcon
                            type={this.isSortedByName ? "text" : "numeric"}
                            order={this.sortConfig.order}
                        />
                    </button>
                </div>
            </div>
        )
    }

    private renderSearchResults(): React.ReactElement {
        if (!this.searchResults || this.searchResults.length === 0) {
            return (
                <div className="entity-search-results grapher_body-3-regular grapher_light">
                    There is no data for the {this.entityType.singular} you are
                    looking for. You may want to try using different keywords or
                    checking for typos.
                </div>
            )
        }

        return (
            <ul className="entity-search-results">
                {this.searchResults.map((entity) => (
                    <li key={entity.name}>
                        <SelectableEntity
                            name={entity.name}
                            type={this.isMultiMode ? "checkbox" : "radio"}
                            checked={this.isEntitySelected(entity)}
                            bar={this.getBarConfigForEntity(entity)}
                            onChange={this.onChange}
                            isLocal={entity.isLocal}
                            isMuted={this.isEntityMuted(entity.name)}
                        />
                    </li>
                ))}
            </ul>
        )
    }

    private renderAllEntitiesInSingleMode(): React.ReactElement {
        const { filteredAvailableEntities, shouldShowFilterBar } = this

        return (
            <>
                {shouldShowFilterBar && this.renderFilterBar()}
                <ul className={cx({ "hide-top-border": shouldShowFilterBar })}>
                    {filteredAvailableEntities.map((entity) => (
                        <li key={entity.name}>
                            <SelectableEntity
                                name={entity.name}
                                type="radio"
                                checked={this.isEntitySelected(entity)}
                                bar={this.getBarConfigForEntity(entity)}
                                onChange={this.onChange}
                                isLocal={entity.isLocal}
                                isMuted={this.isEntityMuted(entity.name)}
                            />
                        </li>
                    ))}
                </ul>
            </>
        )
    }

    @computed private get selectedSortColumn(): CoreColumn | undefined {
        const { sortConfig } = this
        if (this.isSortedByName) return undefined
        return this.interpolatedSortColumnsBySlug[sortConfig.slug]
    }

    @computed private get selectedSortColumnMaxValue(): number | undefined {
        const { selectedSortColumn, endTime } = this
        if (!selectedSortColumn) return undefined
        const time = this.toColumnCompatibleTime(endTime, selectedSortColumn)
        const values = selectedSortColumn.valuesByTime.get(time)
        return _.max(values)
    }

    @computed private get barScale(): ScaleLinear<number, number> {
        return scaleLinear()
            .domain([0, this.selectedSortColumnMaxValue ?? 1])
            .range([0, 1])
    }

    private getBarConfigForEntity(
        entity: SearchableEntity
    ): BarConfig | undefined {
        const { selectedSortColumn, barScale } = this

        if (!selectedSortColumn) return undefined

        const value = entity.sortColumnValues[selectedSortColumn.slug]

        if (!isFiniteWithGuard(value)) return { formattedValue: "No data" }

        const formattedValue =
            selectedSortColumn.formatValueShortWithAbbreviations(value)

        if (value < 0) return { formattedValue, width: 0 }

        return {
            formattedValue:
                selectedSortColumn.formatValueShortWithAbbreviations(value),
            width: R.clamp(barScale(value), { min: 0, max: 1 }),
        }
    }

    private isEntitySelected(entity: SearchableEntity): boolean {
        return this.selectionArray.selectedSet.has(entity.name)
    }

    private renderAllEntitiesInMultiMode(): React.ReactElement {
        const {
            filteredAvailableEntities,
            selectedEntities,
            shouldShowFilterBar,
        } = this
        const { numSelectedEntities, selectedEntityNames } = this.selectionArray

        // having a "Selection" and "Available entities" section both looks odd
        // when all entities are currently selected and there are only a few of them
        const hasFewEntities = filteredAvailableEntities.length < 10
        const shouldHideAvailableEntities =
            !shouldShowFilterBar && hasFewEntities && this.allEntitiesSelected

        return (
            <Flipper
                spring={{ stiffness: 300, damping: 33 }}
                flipKey={selectedEntityNames.join(",")}
            >
                <div className="entity-section">
                    {selectedEntities.length > 0 && (
                        <Flipped flipId="__selection" translate opacity>
                            <div className="entity-section__header">
                                <div className="entity-section__title grapher_body-3-regular-italic grapher_light">
                                    Selection{" "}
                                    {numSelectedEntities > 0 &&
                                        `(${numSelectedEntities})`}
                                </div>
                                <button type="button" onClick={this.onClear}>
                                    Clear
                                </button>
                            </div>
                        </Flipped>
                    )}
                    <ul>
                        {selectedEntities.map((entity, entityIndex) => (
                            <FlippedListItem
                                index={entityIndex}
                                key={entity.name}
                                flipId={`selected_${makeSafeForCSS(
                                    entity.name
                                )}`}
                            >
                                <SelectableEntity
                                    name={entity.name}
                                    type="checkbox"
                                    checked={true}
                                    bar={this.getBarConfigForEntity(entity)}
                                    onChange={this.onChange}
                                    isLocal={entity.isLocal}
                                    isMuted={this.isEntityMuted(entity.name)}
                                />
                            </FlippedListItem>
                        ))}
                    </ul>
                </div>

                {shouldShowFilterBar && (
                    <Flipped flipId="__filter-bar" translate opacity>
                        {this.renderFilterBar()}
                    </Flipped>
                )}

                {!shouldHideAvailableEntities && (
                    <div
                        className={cx("entity-section", {
                            "hide-top-border": shouldShowFilterBar,
                        })}
                    >
                        {!shouldShowFilterBar && (
                            <Flipped flipId="__available" translate opacity>
                                <div className="entity-section__title grapher_body-3-regular-italic grapher_light">
                                    All {this.entityType.plural}
                                </div>
                            </Flipped>
                        )}

                        <ul>
                            {filteredAvailableEntities.map(
                                (entity, entityIndex) => (
                                    <FlippedListItem
                                        index={entityIndex}
                                        key={entity.name}
                                        flipId={`available_${makeSafeForCSS(
                                            entity.name
                                        )}`}
                                    >
                                        <SelectableEntity
                                            name={entity.name}
                                            type="checkbox"
                                            checked={this.isEntitySelected(
                                                entity
                                            )}
                                            bar={this.getBarConfigForEntity(
                                                entity
                                            )}
                                            onChange={this.onChange}
                                            isLocal={entity.isLocal}
                                            isMuted={this.isEntityMuted(
                                                entity.name
                                            )}
                                        />
                                    </FlippedListItem>
                                )
                            )}
                        </ul>
                    </div>
                )}
            </Flipper>
        )
    }

    override render(): React.ReactElement {
        return (
            <div className="entity-selector">
                <OverlayHeader
                    title={this.title}
                    onTitleClick={this.onTitleClick}
                    onDismiss={this.close}
                />

                {this.renderSearchBar()}

                <div ref={this.scrollableContainer} className="scrollable">
                    {!this.searchInput &&
                        this.sortOptions.length > 1 &&
                        this.renderSortBar()}

                    <div
                        ref={this.contentRef}
                        className="entity-selector__content"
                    >
                        {this.searchInput
                            ? this.renderSearchResults()
                            : this.isMultiMode
                              ? this.renderAllEntitiesInMultiMode()
                              : this.renderAllEntitiesInSingleMode()}
                    </div>
                </div>
            </div>
        )
    }
}

type BarConfig = { formattedValue: string; width?: number }

function SelectableEntity({
    name,
    checked,
    type,
    bar,
    onChange,
    isLocal,
    isMuted,
}: {
    name: string
    checked: boolean
    type: "checkbox" | "radio"
    bar?: BarConfig
    onChange: (entityName: EntityName) => void
    isLocal?: boolean
    isMuted?: boolean
}) {
    const Input = {
        checkbox: Checkbox,
        radio: RadioButton,
    }[type]

    const nameWords = name.split(" ")
    const label = isLocal ? (
        <span className="label-with-location-icon">
            {nameWords.slice(0, -1).join(" ")}{" "}
            <span className="label-with-location-icon label-with-location-icon--no-line-break">
                {nameWords[nameWords.length - 1]}
                <Tippy
                    content="Your current location"
                    theme="grapher-explanation--short"
                    placement="top"
                >
                    <FontAwesomeIcon icon={faLocationArrow} />
                </Tippy>
            </span>
        </span>
    ) : (
        name
    )

    return (
        <div
            className={cx("selectable-entity", {
                "selectable-entity--with-bar": bar && bar.width !== undefined,
                "selectable-entity--muted": isMuted,
            })}
        >
            {bar && bar.width !== undefined && (
                <div className="bar" style={{ width: `${bar.width * 100}%` }} />
            )}
            <Input
                label={label}
                checked={checked}
                onChange={() => onChange(name)}
            />
            {bar && (
                <span className="value grapher_label-1-regular">
                    {bar.formattedValue}
                </span>
            )}
        </div>
    )
}

function FlippedListItem({
    flipId,
    index = 0,
    children,
}: {
    flipId: string
    index?: number
    children: React.ReactNode
}) {
    return (
        <Flipped
            flipId={flipId}
            translate
            opacity
            spring={{
                stiffness: Math.max(300 - index, 180),
                damping: 33,
            }}
        >
            <li>{children}</li>
        </Flipped>
    )
}

function formatSortOptionLabel(option: SortDropdownOption): React.ReactElement {
    return (
        <>
            <span className="label">
                <FontAwesomeIcon icon={faArrowRightArrowLeft} size="sm" />
                {"Sort by: "}
            </span>
            {option.label}
            {option.formattedTime && (
                <span className="detail">, {option.formattedTime}</span>
            )}
        </>
    )
}

function formatFilterOptionLabel(
    option: FilterDropdownOption
): React.ReactElement {
    return (
        <>
            <span className="label">
                <FontAwesomeIcon icon={faFilter} size="sm" />
                {"Filter by type: "}
            </span>
            {option.label} <span className="detail">({option.count})</span>
        </>
    )
}

function getTitleForSortColumnLabel(column: CoreColumn): string {
    return column.titlePublicOrDisplayName.title
}

function indicatorIdToSlug(indicatorId: number): ColumnSlug {
    return indicatorId.toString()
}
