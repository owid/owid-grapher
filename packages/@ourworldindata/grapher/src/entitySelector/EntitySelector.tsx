import * as React from "react"
import { observer } from "mobx-react"
import { computed, action, reaction } from "mobx"
import cx from "classnames"
import a from "indefinite"
import {
    isTouchDevice,
    partition,
    SortOrder,
    orderBy,
    isFiniteWithGuard,
    CoreValueType,
    getUserCountryInformation,
    regions,
    sortBy,
    Tippy,
    excludeUndefined,
    FuzzySearch,
    getUserNavigatorLanguagesNonEnglish,
    getRegionAlternativeNames,
    convertDaysSinceEpochToDate,
    max,
    checkIsOwidIncomeGroupName,
    checkHasMembers,
    Region,
    getRegionByName,
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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { SelectionArray } from "../selection/SelectionArray"
import { Flipper, Flipped } from "react-flip-toolkit"
import { makeSelectionArray } from "../chart/ChartUtils.js"
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
    ColumnSlug,
    EntityName,
    MapRegionName,
    OwidColumnDef,
    Time,
} from "@ourworldindata/types"
import { buildVariableTable } from "../core/LegacyToOwidTable"
import { loadVariableDataAndMetadata } from "../core/loadVariable"
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

type CoreColumnBySlug = Record<ColumnSlug, CoreColumn>

type EntityFilter = EntityRegionType | "all"

export interface EntitySelectorState {
    searchInput: string
    sortConfig: SortConfig
    entityFilter: EntityFilter
    localEntityNames?: string[]
    interpolatedSortColumnsBySlug?: CoreColumnBySlug
    isLoadingExternalSortColumn?: boolean
}

export interface EntitySelectorManager {
    entitySelectorState: Partial<EntitySelectorState>
    table: OwidTable
    tableForSelection: OwidTable
    selection: SelectionArray
    entityType?: string
    entityTypePlural?: string
    activeColumnSlugs?: string[]
    dataApiUrl: string
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
    logEntitySelectorEvent: (
        action: EntitySelectorEvent,
        target?: string
    ) => void
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
    value: string // slug
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

@observer
export class EntitySelector extends React.Component<{
    manager: EntitySelectorManager
    selection?: SelectionArray
    autoFocus?: boolean
    onDismiss?: () => void
}> {
    static contextType = DrawerContext

    scrollableContainer: React.RefObject<HTMLDivElement> = React.createRef()
    searchField: React.RefObject<HTMLInputElement> = React.createRef()
    contentRef: React.RefObject<HTMLDivElement> = React.createRef()

    private sortConfigByName: SortConfig = {
        slug: this.table.entityNameSlug,
        order: SortOrder.asc,
    }

    componentDidMount(): void {
        void this.populateLocalEntities()
        this.initSortConfig()

        if (this.props.autoFocus && !isTouchDevice())
            this.searchField.current?.focus()

        // scroll to the top when the search input changes
        reaction(
            () => this.searchInput,
            () => {
                if (this.scrollableContainer.current)
                    this.scrollableContainer.current.scrollTop = 0
            }
        )
    }

    componentWillUnmount(): void {
        if (this.timeoutId) clearTimeout(this.timeoutId)
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
        const { isOnMapTab } = this.manager

        // default to sorting by the first chart column on the map tab
        // or if there's only one y-axis dimension
        const hasSingleYDimension = this.yColumnSlugs.length === 1
        const shouldSortByValue = isOnMapTab || hasSingleYDimension

        if (shouldSortByValue && this.numericalChartColumns[0]) {
            const { slug } = this.numericalChartColumns[0]
            this.setInterpolatedSortColumnBySlug(slug)
            return { slug, order: SortOrder.desc }
        }

        return this.sortConfigByName
    }

    initSortConfig(): void {
        this.set({ sortConfig: this.getDefaultSortConfig() })
    }

    resetInterpolatedMapColumn(): void {
        const { mapColumnSlug } = this.manager
        const sortSlug = this.sortConfig.slug

        // no need to reset the map colum slug if it doesn't exist or isn't set
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

            const sortedUserRegions = sortBy(userRegions, (region) =>
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

    interpolateSortColumn(slug: ColumnSlug): CoreColumn {
        // use map tolerance if on the map tab
        const tolerance = this.manager.isOnMapTab
            ? this.manager.mapConfig?.timeTolerance
            : undefined
        const toleranceStrategy = this.manager.isOnMapTab
            ? this.manager.mapConfig?.toleranceStrategy
            : undefined

        return this.inputTable
            .interpolateColumnWithTolerance(slug, tolerance, toleranceStrategy)
            .get(slug)
    }

    private setInterpolatedSortColumnBySlug(slug: ColumnSlug): void {
        if (this.interpolatedSortColumnsBySlug[slug]) return
        this.setInterpolatedSortColumn(this.interpolateSortColumn(slug))
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

    @computed private get interpolatedSortColumns(): CoreColumn[] {
        return Object.values(this.interpolatedSortColumnsBySlug)
    }

    @computed private get isLoadingExternalSortColumn(): boolean {
        return (
            this.manager.entitySelectorState.isLoadingExternalSortColumn ??
            false
        )
    }

    @computed private get inputTable(): OwidTable {
        return this.manager.table
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
            .filter(
                (column) => column.hasNumberFormatting && !column.isProjection
            )
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

    @computed get sortOptions(): SortDropdownOption[] {
        const options: SortDropdownOption[] = []

        // the first dropdown option is always the entity name
        options.push({
            value: this.table.entityNameSlug,
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
                        value: chartColumn.slug,
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
                        value: external.slug,
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
        // excluding those that match external indicators
        const matchingSlugs = Object.values(
            this.chartColumnsByExternalSortIndicatorKey
        ).map((column) => column.slug)
        for (const column of this.numericalChartColumns) {
            if (!matchingSlugs.includes(column.slug)) {
                options.push({
                    value: column.slug,
                    label: getTitleForSortColumnLabel(column),
                    formattedTime: this.formatTimeForSortColumnLabel(
                        this.endTime,
                        column
                    ),
                })
            }
        }

        return options
    }

    @computed get sortValue(): SortDropdownOption | null {
        return (
            this.sortOptions.find(
                (option) => option.value === this.sortConfig.slug
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
                const rowsByTime =
                    column.owidRowByEntityNameAndTime.get(entityName)
                searchableEntity.sortColumnValues[column.slug] =
                    rowsByTime?.get(time)?.value
            }

            return searchableEntity
        })
    }

    @computed private get filteredAvailableEntities(): SearchableEntity[] {
        const { availableEntities, entityFilter } = this

        if (entityFilter === "all") return this.sortEntities(availableEntities)

        const entityNameSet = new Set(
            this.manager.entityNamesByRegionType?.get(entityFilter) ?? []
        )
        const filteredAvailableEntities = availableEntities.filter((entity) =>
            entityNameSet.has(entity.name)
        )

        return this.sortEntities(filteredAvailableEntities, {
            // non-country groups are usually small,
            // so sorting local entities to the top isn't necessary
            sortLocalsAndWorldToTop: entityFilter === "countries",
        })
    }

    private sortEntities(
        entities: SearchableEntity[],
        options: { sortLocalsAndWorldToTop: boolean } = {
            sortLocalsAndWorldToTop: true,
        }
    ): SearchableEntity[] {
        const { sortConfig } = this

        const shouldBeSortedByName =
            sortConfig.slug === this.table.entityNameSlug

        // sort by name, ignoring local entities
        if (shouldBeSortedByName && !options.sortLocalsAndWorldToTop) {
            return orderBy(
                entities,
                (entity: SearchableEntity) => entity.name,
                sortConfig.order
            )
        }

        // sort by name, with local entities at the top
        if (shouldBeSortedByName && options.sortLocalsAndWorldToTop) {
            const [[worldEntity], entitiesWithoutWorld] = partition(
                entities,
                (entity) => isWorldEntityName(entity.name)
            )

            const [localEntities, otherEntities] = partition(
                entitiesWithoutWorld,
                (entity: SearchableEntity) => entity.isLocal
            )

            const sortedLocalEntities = sortBy(
                localEntities,
                (entity: SearchableEntity) =>
                    this.localEntityNames?.indexOf(entity.name)
            )

            const sortedOtherEntities = orderBy(
                otherEntities,
                (entity: SearchableEntity) => entity.name,
                sortConfig.order
            )

            return excludeUndefined([
                ...sortedLocalEntities,
                worldEntity,
                ...sortedOtherEntities,
            ])
        }

        // sort by number column, with missing values at the end
        const [withValues, withoutValues] = partition(
            entities,
            (entity: SearchableEntity) =>
                isFiniteWithGuard(entity.sortColumnValues[sortConfig.slug])
        )
        const sortedEntitiesWithValues = orderBy(
            withValues,
            (entity: SearchableEntity) =>
                entity.sortColumnValues[sortConfig.slug],
            sortConfig.order
        )
        const sortedEntitiesWithoutValues = orderBy(
            withoutValues,
            (entity: SearchableEntity) => entity.name,
            SortOrder.asc
        )

        return [...sortedEntitiesWithValues, ...sortedEntitiesWithoutValues]
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
        return this.sortEntities(selected, { sortLocalsAndWorldToTop: false })
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

    private timeoutId?: NodeJS.Timeout
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
                this.timeoutId = setTimeout(() => this.close(), 200)
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

        // the indicator has already been loaded
        if (this.interpolatedSortColumnsBySlug[slug]) return

        // load the external indicator
        try {
            this.set({ isLoadingExternalSortColumn: true })
            const variable = await loadVariableDataAndMetadata(
                indicatorId,
                this.manager.dataApiUrl
            )
            const variableTable = buildVariableTable(variable)
            const column = variableTable
                .filterByEntityNames(this.inputTable.availableEntityNames)
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
            const { value: slug } = selected

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
                    value={this.searchInput}
                    onChange={(value) => this.set({ searchInput: value })}
                    onClear={() => this.clearSearchInput()}
                    placeholder={`Search for ${a(this.searchPlaceholderEntityType)}`}
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
        return max(values)
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
                                flipId={"selected_" + entity.name}
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
                                        flipId={"available_" + entity.name}
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

    render(): React.ReactElement {
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
