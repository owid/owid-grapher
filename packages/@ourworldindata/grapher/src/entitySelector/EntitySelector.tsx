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
    clamp,
    getUserCountryInformation,
    regions,
    sortBy,
    Tippy,
    excludeUndefined,
    FuzzySearch,
    getUserNavigatorLanguagesNonEnglish,
    getRegionAlternativeNames,
    toDate,
} from "@ourworldindata/utils"
import {
    Checkbox,
    RadioButton,
    OverlayHeader,
} from "@ourworldindata/components"
import {
    faCircleXmark,
    faMagnifyingGlass,
    faLocationArrow,
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
import { ColumnSlug, OwidColumnDef, Time } from "@ourworldindata/types"
import { buildVariableTable } from "../core/LegacyToOwidTable"
import { loadVariableDataAndMetadata } from "../core/loadVariable"
import { DrawerContext } from "../slideInDrawer/SlideInDrawer.js"
import { FocusArray } from "../focus/FocusArray"

type CoreColumnBySlug = Record<ColumnSlug, CoreColumn>

export interface EntitySelectorState {
    searchInput: string
    sortConfig: SortConfig
    localEntityNames?: string[]
    interpolatedSortColumnsBySlug?: CoreColumnBySlug
    isLoadingExternalSortColumn?: boolean
}

export interface EntitySelectorManager {
    entitySelectorState: Partial<EntitySelectorState>
    tableForSelection: OwidTable
    selection: SelectionArray
    entityType?: string
    entityTypePlural?: string
    activeColumnSlugs?: string[]
    dataApiUrl: string
    isEntitySelectorModalOrDrawerOpen?: boolean
    canChangeEntity?: boolean
    canHighlightEntities?: boolean
    focusArray?: FocusArray
    endTime?: Time
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
}

interface PartitionedEntities {
    selected: SearchableEntity[]
    unselected: SearchableEntity[]
}

interface DropdownOption {
    value: string
    label: string
}

const EXTERNAL_SORT_INDICATOR_DEFINITIONS = [
    {
        label: "Population",
        indicatorId: POPULATION_INDICATOR_ID_USED_IN_ENTITY_SELECTOR,
        slug: indicatorIdToSlug(
            POPULATION_INDICATOR_ID_USED_IN_ENTITY_SELECTOR
        ),
        // checks if a column has population data
        isMatch: (column: CoreColumn): boolean =>
            isPopulationVariableETLPath(
                (column.def as OwidColumnDef)?.catalogPath ?? ""
            ),
    },
    {
        label: "GDP per capita (int. $)",
        indicatorId: GDP_PER_CAPITA_INDICATOR_ID_USED_IN_ENTITY_SELECTOR,
        slug: indicatorIdToSlug(
            GDP_PER_CAPITA_INDICATOR_ID_USED_IN_ENTITY_SELECTOR
        ),
        // checks if a column has GDP per capita data
        isMatch: (column: CoreColumn): boolean => {
            const label = column.titlePublicOrDisplayName.title

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

const regionNamesSet = new Set(regions.map((region) => region.name))

@observer
export class EntitySelector extends React.Component<{
    manager: EntitySelectorManager
    onDismiss?: () => void
    autoFocus?: boolean
}> {
    static contextType = DrawerContext

    scrollableContainer: React.RefObject<HTMLDivElement> = React.createRef()
    searchField: React.RefObject<HTMLInputElement> = React.createRef()
    contentRef: React.RefObject<HTMLDivElement> = React.createRef()

    private defaultSortConfig = {
        slug: this.table.entityNameSlug,
        order: SortOrder.asc,
    }

    componentDidMount(): void {
        void this.populateLocalEntities()

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

    @action.bound async populateLocalEntities(): Promise<void> {
        try {
            const localCountryInfo = await getUserCountryInformation()
            if (!localCountryInfo) return

            const userEntityCodes = [
                localCountryInfo.code,
                ...(localCountryInfo.regions ?? []),
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

    private setInterpolatedSortColumn(column?: CoreColumn): void {
        if (!column) return
        this.set({
            interpolatedSortColumnsBySlug: {
                ...this.interpolatedSortColumnsBySlug,
                [column.slug]: column,
            },
        })
    }

    private clearSearchInput(): void {
        this.set({ searchInput: "" })
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
     * This is necessary for daily charts since the external sort indicators
     * (population, gdp per capita) typically have yearly date.
     */
    private toColumnCompatibleTime(time: Time, column: CoreColumn): Time {
        return this.chartHasDailyData && !column.display?.yearIsDay
            ? toDate(time).year()
            : time
    }

    private clampWithinColumnTimeRange(time: Time, column: CoreColumn): Time {
        return clamp(time, column.minTime, column.maxTime)
    }

    private makeLabelForSortColumn(
        column?: CoreColumn,
        customTitle?: string
    ): string {
        if (!column) return customTitle ?? ""

        const title = customTitle ?? column.titlePublicOrDisplayName.title

        const endTime = this.toColumnCompatibleTime(this.endTime, column)
        const clampedTime = this.clampWithinColumnTimeRange(endTime, column)

        // don't add time to the label if it's the same as the currently selected time
        if (endTime === clampedTime) return makeLabel(title)

        const formattedTime = column.formatTime(clampedTime)
        return makeLabel(title, formattedTime)
    }

    @computed private get manager(): EntitySelectorManager {
        return this.props.manager
    }

    @computed private get endTime(): Time {
        return this.manager.endTime!
    }

    @computed private get title(): string {
        return this.manager.canHighlightEntities
            ? `Select ${this.entityTypePlural}`
            : this.manager.canChangeEntity
              ? `Choose ${a(this.entityType)}`
              : `Add/remove ${this.entityTypePlural}`
    }

    @computed private get searchInput(): string {
        return this.manager.entitySelectorState.searchInput ?? ""
    }

    @computed private get sortConfig(): SortConfig {
        return (
            this.manager.entitySelectorState.sortConfig ??
            this.defaultSortConfig
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

    @computed private get table(): OwidTable {
        return this.manager.tableForSelection
    }

    @computed private get entitiesAreCountriesOrRegions(): boolean {
        for (const entityName of this.availableEntityNames) {
            if (regionNamesSet.has(entityName)) return true
        }
        return true
    }

    @computed private get supportsSortingByExternalIndicators(): boolean {
        // Adding external indicators like population and gdp per capita
        // only makes sense for charts with countries or regions
        return this.entitiesAreCountriesOrRegions
    }

    @computed private get numericalChartColumns(): CoreColumn[] {
        const activeSlugs = this.manager.activeColumnSlugs ?? []
        return activeSlugs
            .map((slug) => this.table.get(slug))
            .filter(
                (column) => column.hasNumberFormatting && !column.isProjection
            )
    }

    @computed
    private get chartColumnSlugsThatMatchSomeExternalIndicator(): Set<ColumnSlug> {
        return new Set(
            excludeUndefined(
                EXTERNAL_SORT_INDICATOR_DEFINITIONS.map(
                    (external) =>
                        this.numericalChartColumns.find((column) =>
                            external.isMatch(column)
                        )?.slug
                )
            )
        )
    }

    @computed
    private get externalSortIndicatorDefinitions(): ExternalSortIndicatorDefinition[] {
        if (!this.supportsSortingByExternalIndicators) return []

        // if the chart has a column that is matches an external sort indicator,
        // prefer the chart column over the external indicator
        return EXTERNAL_SORT_INDICATOR_DEFINITIONS.filter(
            (external) =>
                !this.chartColumnSlugsThatMatchSomeExternalIndicator.has(
                    external.slug
                )
        )
    }

    @computed get sortOptions(): DropdownOption[] {
        const options: DropdownOption[] = []

        // the first dropdown option is always the entity name
        options.push({
            value: this.table.entityNameSlug,
            label: "Name",
        })

        // add external indicators as sort options if applicable
        if (this.supportsSortingByExternalIndicators) {
            EXTERNAL_SORT_INDICATOR_DEFINITIONS.forEach((external) => {
                // if the chart has a column that is matches the external
                // indicator, prefer it over the external indicator
                const isMatch =
                    this.chartColumnSlugsThatMatchSomeExternalIndicator.has(
                        external.slug
                    )

                if (isMatch) {
                    const column = this.table.get(external.slug)
                    options.push({
                        value: column.slug,
                        label: this.makeLabelForSortColumn(column),
                    })
                } else {
                    const column =
                        this.interpolatedSortColumnsBySlug[external.slug]
                    options.push({
                        value: external.slug,
                        label: this.makeLabelForSortColumn(
                            column,
                            external.label
                        ),
                    })
                }
            })
        }

        const remainingChartColumns = this.numericalChartColumns.filter(
            (column) =>
                !this.chartColumnSlugsThatMatchSomeExternalIndicator.has(
                    column.slug
                )
        )
        options.push(
            ...remainingChartColumns.map((column) => ({
                value: column.slug,
                label: this.makeLabelForSortColumn(column),
            }))
        )

        return options
    }

    @computed get sortValue(): DropdownOption | null {
        return (
            this.sortOptions.find(
                (option) => option.value === this.sortConfig.slug
            ) ?? null
        )
    }

    @computed private get isSortedByName(): boolean {
        return this.sortConfig.slug === this.table.entityNameSlug
    }

    @computed private get entityType(): string {
        return this.manager.entityType || DEFAULT_GRAPHER_ENTITY_TYPE
    }

    @computed private get entityTypePlural(): string {
        return (
            this.manager.entityTypePlural || DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL
        )
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
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

    @computed private get availableEntities(): SearchableEntity[] {
        const langs = getUserNavigatorLanguagesNonEnglish()

        return this.availableEntityNames.map((entityName) => {
            const searchableEntity: SearchableEntity = {
                name: entityName,
                sortColumnValues: {},
                alternativeNames: getRegionAlternativeNames(entityName, langs),
            }

            if (this.localEntityNames) {
                searchableEntity.isLocal =
                    this.localEntityNames.includes(entityName)
            }

            for (const column of this.interpolatedSortColumns) {
                const endTime = this.toColumnCompatibleTime(
                    this.endTime,
                    column
                )
                const time = this.clampWithinColumnTimeRange(endTime, column)
                const rowsByTime =
                    column.owidRowByEntityNameAndTime.get(entityName)
                searchableEntity.sortColumnValues[column.slug] =
                    rowsByTime?.get(time)?.value
            }

            return searchableEntity
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

    @computed private get sortedAvailableEntities(): SearchableEntity[] {
        return this.sortEntities(this.availableEntities)
    }

    @computed get isMultiMode(): boolean {
        return !this.manager.canChangeEntity
    }

    @computed get fuzzy(): FuzzySearch<SearchableEntity> {
        return FuzzySearch.withKeyArray(
            this.sortedAvailableEntities,
            (entity) => [entity.name, ...(entity.alternativeNames ?? [])],
            (entity) => entity.name
        )
    }

    @computed get searchResults(): SearchableEntity[] | undefined {
        if (!this.searchInput) return undefined
        return this.fuzzy.search(this.searchInput)
    }

    @computed get partitionedSearchResults(): PartitionedEntities | undefined {
        const { searchResults } = this

        if (!searchResults) return undefined

        const [selected, unselected] = partition(
            searchResults,
            (entity: SearchableEntity) => this.isEntitySelected(entity)
        )

        return { selected, unselected }
    }

    @computed get partitionedAvailableEntities(): PartitionedEntities {
        const [selected, unselected] = partition(
            this.sortedAvailableEntities,
            (entity: SearchableEntity) => this.isEntitySelected(entity)
        )

        return {
            selected: this.sortEntities(selected, {
                sortLocalsAndWorldToTop: false,
            }),
            unselected: this.sortEntities(unselected),
        }
    }

    @computed get partitionedVisibleEntities(): PartitionedEntities {
        return (
            this.partitionedSearchResults ?? this.partitionedAvailableEntities
        )
    }

    @action.bound onTitleClick(): void {
        if (this.scrollableContainer.current)
            this.scrollableContainer.current.scrollTop = 0
    }

    @action.bound onSearchKeyDown(e: React.KeyboardEvent<HTMLElement>): void {
        const { searchResults } = this
        if (e.key === "Enter" && searchResults && searchResults.length > 0) {
            this.onChange(searchResults[0].name)
            this.clearSearchInput()
        }
    }

    private timeoutId?: NodeJS.Timeout
    @action.bound onChange(entityName: string): void {
        if (this.isMultiMode) {
            this.selectionArray.toggleSelection(entityName)
        } else {
            this.selectionArray.setSelectedEntities([entityName])
        }

        // remove focus from an entity that has been removed from the selection
        if (!this.selectionArray.selectedSet.has(entityName)) {
            this.manager.focusArray?.remove(entityName)
        }

        this.clearSearchInput()

        // close the modal or drawer automatically after selection if in single mode
        if (
            !this.isMultiMode &&
            this.manager.isEntitySelectorModalOrDrawerOpen
        ) {
            this.timeoutId = setTimeout(() => this.close(), 200)
        }
    }

    @action.bound onClear(): void {
        const { partitionedSearchResults } = this
        if (this.searchInput) {
            const { selected = [] } = partitionedSearchResults ?? {}
            const entityNames = selected.map((entity) => entity.name)
            this.selectionArray.deselectEntities(entityNames)
            this.manager.focusArray?.remove(...entityNames)
        } else {
            this.selectionArray.clearSelection()
            this.manager.focusArray?.clear()
        }
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
                .interpolateColumnWithTolerance(slug, Infinity)
                .get(slug)
            if (column) this.setInterpolatedSortColumn(column)
        } catch {
            console.error(`Failed to load variable with id ${indicatorId}`)
        } finally {
            this.set({ isLoadingExternalSortColumn: false })
        }
    }

    @action.bound async onChangeSortSlug(selected: unknown): Promise<void> {
        if (selected) {
            const { value: slug } = selected as DropdownOption

            // if an external indicator has been selected, load it
            const external = this.externalSortIndicatorDefinitions.find(
                (external) => external.slug === slug
            )
            if (external) await this.loadAndSetExternalSortColumn(external)

            // apply tolerance if an indicator is selected for the first time
            if (!this.interpolatedSortColumnsBySlug[slug]) {
                const interpolatedColumn = this.table
                    .interpolateColumnWithTolerance(slug)
                    .get(slug)
                this.setInterpolatedSortColumn(interpolatedColumn)
            }

            this.updateSortSlug(slug)
        }
    }

    @action.bound onChangeSortOrder(): void {
        this.toggleSortOrder()
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

    private renderSearchBar(): React.ReactElement {
        return (
            <div className="entity-selector__search-bar">
                <div
                    className={cx("search-input", {
                        "search-input--empty": !this.searchInput,
                    })}
                >
                    <input
                        ref={this.searchField}
                        type="search"
                        placeholder={`Search for ${a(this.entityType)}`}
                        value={this.searchInput}
                        onChange={action((e): void => {
                            this.set({
                                searchInput: e.currentTarget.value,
                            })
                        })}
                        onKeyDown={this.onSearchKeyDown}
                    />
                    <FontAwesomeIcon
                        className="search-icon"
                        icon={faMagnifyingGlass}
                    />
                    {this.searchInput && (
                        <button
                            type="button"
                            className="clear"
                            onClick={action(() => this.clearSearchInput())}
                        >
                            <FontAwesomeIcon icon={faCircleXmark} />
                        </button>
                    )}
                </div>
            </div>
        )
    }

    private renderSortBar(): React.ReactElement {
        return (
            <div className="entity-selector__sort-bar">
                <span className="label grapher_label-2-medium grapher_light">
                    Sort by
                </span>
                <Dropdown
                    options={this.sortOptions}
                    onChange={this.onChangeSortSlug}
                    value={this.sortValue}
                    isLoading={this.isLoadingExternalSortColumn}
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
        )
    }

    private renderSearchResults(): React.ReactElement {
        if (!this.searchResults || this.searchResults.length === 0) {
            return (
                <div className="entity-search-results grapher_body-3-regular grapher_light">
                    There is no data for the {this.entityType} you are looking
                    for. You may want to try using different keywords or
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
                            onChange={() => this.onChange(entity.name)}
                            isLocal={entity.isLocal}
                        />
                    </li>
                ))}
            </ul>
        )
    }

    private renderAllEntitiesInSingleMode(): React.ReactElement {
        const { sortedAvailableEntities } = this

        return (
            <ul>
                {sortedAvailableEntities.map((entity) => (
                    <li key={entity.name}>
                        <SelectableEntity
                            name={entity.name}
                            type="radio"
                            checked={this.isEntitySelected(entity)}
                            bar={this.getBarConfigForEntity(entity)}
                            onChange={() => this.onChange(entity.name)}
                            isLocal={entity.isLocal}
                        />
                    </li>
                ))}
            </ul>
        )
    }

    @computed private get displayColumn(): CoreColumn | undefined {
        const { sortConfig } = this
        if (this.isSortedByName) return undefined
        return this.interpolatedSortColumnsBySlug[sortConfig.slug]
    }

    @computed private get barScale(): ScaleLinear<number, number> {
        return scaleLinear()
            .domain([0, this.displayColumn?.maxValue ?? 1])
            .range([0, 1])
    }

    private getBarConfigForEntity(
        entity: SearchableEntity
    ): BarConfig | undefined {
        const { displayColumn, barScale } = this

        if (!displayColumn) return undefined

        const value = entity.sortColumnValues[displayColumn.slug]

        if (!isFiniteWithGuard(value)) return { formattedValue: "No data" }

        return {
            formattedValue:
                displayColumn.formatValueShortWithAbbreviations(value),
            width: clamp(barScale(value), 0, 1),
        }
    }

    private isEntitySelected(entity: SearchableEntity): boolean {
        return this.selectionArray.selectedSet.has(entity.name)
    }

    private renderAllEntitiesInMultiMode(): React.ReactElement {
        const {
            sortedAvailableEntities,
            partitionedVisibleEntities: visibleEntities,
        } = this
        const { selected } = this.partitionedAvailableEntities
        const { numSelectedEntities, selectedEntityNames } = this.selectionArray

        // having a "Selection" and "Available entities" section both looks odd
        // when all entities are currently selected and there are only a few of them
        const hasFewEntities = sortedAvailableEntities.length < 10
        const hideAvailableEntities = hasFewEntities && this.allEntitiesSelected

        return (
            <Flipper
                spring={{ stiffness: 300, damping: 33 }}
                flipKey={selectedEntityNames.join(",")}
            >
                <div className="entity-section">
                    {selected.length > 0 && (
                        <Flipped flipId="__selection" translate opacity>
                            <div className="entity-section__header">
                                <div className="entity-section__title grapher_body-3-medium-italic grapher_light">
                                    Selection{" "}
                                    {numSelectedEntities > 0 &&
                                        `(${numSelectedEntities})`}
                                </div>
                                <button
                                    type="button"
                                    onClick={this.onClear}
                                    disabled={
                                        visibleEntities.selected.length === 0
                                    }
                                >
                                    Clear
                                </button>
                            </div>
                        </Flipped>
                    )}
                    <ul>
                        {selected.map((entity, entityIndex) => (
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
                                    onChange={() => this.onChange(entity.name)}
                                    isLocal={entity.isLocal}
                                />
                            </FlippedListItem>
                        ))}
                    </ul>
                </div>

                {!hideAvailableEntities && (
                    <div className="entity-section">
                        <Flipped flipId="__available" translate opacity>
                            <div className="entity-section__title grapher_body-3-medium-italic grapher_light">
                                All {this.entityTypePlural}
                            </div>
                        </Flipped>

                        <ul>
                            {sortedAvailableEntities.map(
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
                                            onChange={() =>
                                                this.onChange(entity.name)
                                            }
                                            isLocal={entity.isLocal}
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
}: {
    name: string
    checked: boolean
    type: "checkbox" | "radio"
    bar?: BarConfig
    onChange: () => void
    isLocal?: boolean
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
            })}
        >
            {bar && bar.width !== undefined && (
                <div className="bar" style={{ width: `${bar.width * 100}%` }} />
            )}
            <Input label={label} checked={checked} onChange={onChange} />
            {bar && (
                <span className="value grapher_label-1-medium">
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
            <li className="flipped">{children}</li>
        </Flipped>
    )
}

function makeLabel(label: string, formattedTime?: string): string {
    return formattedTime ? `${label} (${formattedTime})` : label
}

function indicatorIdToSlug(indicatorId: number): ColumnSlug {
    return indicatorId.toString()
}
