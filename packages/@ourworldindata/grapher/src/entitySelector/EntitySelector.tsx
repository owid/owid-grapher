import React from "react"
import { observer } from "mobx-react"
import { computed, action, reaction } from "mobx"
import cx from "classnames"
import a from "indefinite"
import {
    isTouchDevice,
    partition,
    capitalize,
    SortOrder,
    orderBy,
    keyBy,
    isFiniteWithGuard,
    CoreValueType,
    clamp,
    maxBy,
    getUserCountryInformation,
    regions,
    sortBy,
    Tippy,
    excludeUndefined,
    intersection,
} from "@ourworldindata/utils"
import { Checkbox } from "@ourworldindata/components"
import { FuzzySearch } from "../controls/FuzzySearch"
import {
    faCircleXmark,
    faMagnifyingGlass,
    faLocationArrow,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { SelectionArray } from "../selection/SelectionArray"
import { Flipper, Flipped } from "react-flip-toolkit"
import { RadioButton } from "../controls/RadioButton"
import { makeSelectionArray } from "../chart/ChartUtils.js"
import {
    DEFAULT_GRAPHER_ENTITY_TYPE,
    DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
    GRAPHER_ENTITY_SELECTOR_CLASS,
    GRAPHER_SCROLLABLE_CONTAINER_CLASS,
    POPULATION_INDICATOR_ID_USED_IN_ENTITY_SELECTOR,
    GDP_PER_CAPITA_INDICATOR_ID_USED_IN_ENTITY_SELECTOR,
    isPopulationVariableId,
} from "../core/GrapherConstants"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { SortIcon } from "../controls/SortIcon"
import { Dropdown } from "../controls/Dropdown"
import { scaleLinear, type ScaleLinear } from "d3-scale"
import { ColumnSlug } from "@ourworldindata/types"
import { buildVariableTable } from "../core/LegacyToOwidTable"
import { loadVariableDataAndMetadata } from "../core/loadVariable"

export interface EntitySelectorState {
    searchInput: string
    sortConfig: SortConfig
    localEntityNames?: string[]
    mostRecentlySelectedEntityName?: string
    populationColumn?: CoreColumn
    gdpPerCapitaColumn?: CoreColumn
    isLoadingExternalSortColumn?: boolean
}

export interface EntitySelectorManager {
    entitySelectorState: Partial<EntitySelectorState>
    tableForSelection: OwidTable
    selection: SelectionArray
    canChangeEntity: boolean
    entityType?: string
    entityTypePlural?: string
    activeColumnSlugs?: string[]
    dataApiUrl: string
}

interface SortConfig {
    slug: ColumnSlug
    order: SortOrder
}

type SearchableEntity = { name: string; local?: boolean } & Record<
    ColumnSlug,
    CoreValueType | undefined
>

interface PartitionedEntities {
    selected: SearchableEntity[]
    unselected: SearchableEntity[]
}

interface DropdownOption {
    value: string
    label: string
}

const DEFAULT_POPULATION_INDICATOR_ID =
    POPULATION_INDICATOR_ID_USED_IN_ENTITY_SELECTOR
const DEFAULT_POPULATION_LABEL = "Population"

const DEFAULT_GDP_PER_CAPITA_INDICATOR_ID =
    GDP_PER_CAPITA_INDICATOR_ID_USED_IN_ENTITY_SELECTOR
const DEFAULT_GDP_PER_CAPITA_LABEL = "GDP per capita"

@observer
export class EntitySelector extends React.Component<{
    manager: EntitySelectorManager
    onDismiss?: () => void
    autoFocus?: boolean
}> {
    container: React.RefObject<HTMLDivElement> = React.createRef()
    searchField: React.RefObject<HTMLInputElement> = React.createRef()

    private defaultSortConfig = {
        slug: this.table.entityNameSlug,
        order: SortOrder.asc,
    }

    componentDidMount(): void {
        void this.populateLocalEntities()

        if (this.props.autoFocus && !isTouchDevice())
            this.searchField.current?.focus()

        const scrollableContainer = this.container.current?.closest(
            `.${GRAPHER_SCROLLABLE_CONTAINER_CLASS}`
        )

        // scroll to the top when the search input changes
        reaction(
            () => this.searchInput,
            () => {
                if (scrollableContainer) scrollableContainer.scrollTop = 0
            }
        )
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
        } catch (err) {}
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

    @computed private get manager(): EntitySelectorManager {
        return this.props.manager
    }

    @computed private get searchInput(): string {
        return this.manager.entitySelectorState.searchInput ?? ""
    }

    @computed private get mostRecentlySelectedEntityName(): string | undefined {
        return this.manager.entitySelectorState.mostRecentlySelectedEntityName
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

    @computed private get populationColumn(): CoreColumn | undefined {
        return this.manager.entitySelectorState.populationColumn
    }

    @computed private get gdpPerCapitaColumn(): CoreColumn | undefined {
        return this.manager.entitySelectorState.gdpPerCapitaColumn
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

    @computed private get hasCountryOrRegionEntities(): boolean {
        return (
            intersection(
                this.availableEntityNames,
                regions.map((region) => region.name)
            ).length > 0
        )
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
    private get numericalChartColumnsWithoutPopulationAndGdpPerCapita(): CoreColumn[] {
        return this.numericalChartColumns.filter(
            (column) =>
                column.slug !== this.populationSlug &&
                column.slug !== this.gdpPerCapitaSlug
        )
    }

    @computed private get sortColumns(): CoreColumn[] {
        return excludeUndefined([
            this.table.entityNameColumn,
            this.populationColumn,
            this.gdpPerCapitaColumn,
            ...this.numericalChartColumnsWithoutPopulationAndGdpPerCapita,
        ])
    }

    @computed private get populationColumnUsedInChart():
        | CoreColumn
        | undefined {
        const activePopulationColumn = this.numericalChartColumns.find(
            (column) => isPopulationVariableId(column.slug)
        )
        return activePopulationColumn
    }

    /**
     * Either the ID of a population indicator used in the chart,
     * or the default population indicator ID (or undefined if we
     * don't want to sort by population)
     */
    @computed private get populationIndicatorId(): number | undefined {
        if (this.populationColumnUsedInChart)
            return +this.populationColumnUsedInChart.slug

        if (this.hasCountryOrRegionEntities)
            return DEFAULT_POPULATION_INDICATOR_ID

        return undefined
    }

    @computed private get populationSlug(): ColumnSlug | undefined {
        return this.populationIndicatorId !== undefined
            ? this.populationIndicatorId.toString()
            : undefined
    }

    @computed private get gdpPerCapitaColumnUsedInChart():
        | CoreColumn
        | undefined {
        const activeGdpPerCapitaColumn = this.numericalChartColumns.find(
            (column) => {
                const label = makeColumnLabel(column)

                // matches "gdp per capita" and content within parentheses
                const potentialMatches =
                    label.match(/\(.*?\)|(\bgdp per capita\b)/gi) ?? []
                // filter for "gdp per capita" matches that are not within parentheses
                const matches = potentialMatches.filter(
                    (match) => !match.includes("(")
                )

                return matches.length > 0
            }
        )
        return activeGdpPerCapitaColumn
    }

    /**
     * Either the ID of a GDP per capita indicator used in the chart,
     * or the default GDP per capita indicator ID (or undefined if we
     * don't want to sort by GDP per capita)
     */
    @computed private get gdpPerCapitaIndicatorId(): number | undefined {
        if (this.gdpPerCapitaColumnUsedInChart)
            return +this.gdpPerCapitaColumnUsedInChart.slug

        if (this.hasCountryOrRegionEntities)
            return DEFAULT_GDP_PER_CAPITA_INDICATOR_ID

        return undefined
    }

    @computed private get gdpPerCapitaSlug(): ColumnSlug | undefined {
        return this.gdpPerCapitaIndicatorId !== undefined
            ? this.gdpPerCapitaIndicatorId.toString()
            : undefined
    }

    @computed private get sortColumnsBySlug(): Record<ColumnSlug, CoreColumn> {
        return keyBy(this.sortColumns, (column: CoreColumn) => column.slug)
    }

    @computed get sortOptions(): DropdownOption[] {
        const options: DropdownOption[] = []

        // the first dropdown option is always the entity name
        options.push({
            value: this.table.entityNameSlug,
            label: "Name",
        })

        // add population to the dropdown if applicable
        if (this.populationSlug) {
            options.push({
                value: this.populationSlug,
                label: this.populationColumnUsedInChart
                    ? makeColumnLabel(this.populationColumnUsedInChart)
                    : DEFAULT_POPULATION_LABEL,
            })
        }

        // add GDP per capita to the dropdown if applicable
        if (this.gdpPerCapitaSlug) {
            options.push({
                value: this.gdpPerCapitaSlug,
                label: this.gdpPerCapitaColumnUsedInChart
                    ? makeColumnLabel(this.gdpPerCapitaColumnUsedInChart)
                    : DEFAULT_GDP_PER_CAPITA_LABEL,
            })
        }

        // add chart columns to the dropdown
        const chartColumns =
            this.numericalChartColumnsWithoutPopulationAndGdpPerCapita
        options.push(
            ...chartColumns.map((column) => {
                return {
                    value: column.slug,
                    label: makeColumnLabel(column),
                }
            })
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

    @computed private get availableEntityNames(): string[] {
        return this.table.availableEntityNames
    }

    @computed private get availableEntities(): SearchableEntity[] {
        return this.availableEntityNames.map((entityName) => {
            const searchableEntity: SearchableEntity = { name: entityName }

            if (this.localEntityNames) {
                searchableEntity.local =
                    this.localEntityNames.includes(entityName)
            }

            for (const column of this.sortColumns) {
                const rows = column.owidRowsByEntityName.get(entityName) ?? []
                searchableEntity[column.slug] = maxBy(
                    rows,
                    (row) => row.time
                )?.value
            }

            return searchableEntity
        })
    }

    private sortEntities(
        entities: SearchableEntity[],
        options: { sortLocalsToTop: boolean } = { sortLocalsToTop: true }
    ): SearchableEntity[] {
        const { sortConfig } = this

        const shouldBeSortedByName =
            sortConfig.slug === this.table.entityNameSlug

        // sort by name, ignoring local entities
        if (shouldBeSortedByName && !options.sortLocalsToTop) {
            return orderBy(
                entities,
                (entity: SearchableEntity) => entity.name,
                sortConfig.order
            )
        }

        // sort by name, with local entities at the top
        if (shouldBeSortedByName && options.sortLocalsToTop) {
            const [localEntities, otherEntities] = partition(
                entities,
                (entity: SearchableEntity) => entity.local
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

            return [...sortedLocalEntities, ...sortedOtherEntities]
        }

        // sort by number column, with missing values at the end
        const [withValues, withoutValues] = partition(
            entities,
            (entity: SearchableEntity) =>
                isFiniteWithGuard(entity[sortConfig.slug])
        )
        const sortedEntitiesWithValues = orderBy(
            withValues,
            (entity: SearchableEntity) => entity[sortConfig.slug],
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
        return new FuzzySearch(this.sortedAvailableEntities, "name")
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
            selected: this.sortEntities(selected, { sortLocalsToTop: false }),
            unselected: this.sortEntities(unselected),
        }
    }

    @computed get partitionedVisibleEntities(): PartitionedEntities {
        return (
            this.partitionedSearchResults ?? this.partitionedAvailableEntities
        )
    }

    @action.bound onSearchKeyDown(e: React.KeyboardEvent<HTMLElement>): void {
        const { searchResults } = this
        if (e.key === "Enter" && searchResults && searchResults.length > 0) {
            this.onChange(searchResults[0].name)
            this.clearSearchInput()
        }
    }

    @action.bound onChange(entityName: string): void {
        if (this.isMultiMode) {
            this.selectionArray.toggleSelection(entityName)
        } else {
            this.selectionArray.setSelectedEntities([entityName])
            if (this.props.onDismiss) this.props.onDismiss()
        }

        this.set({ mostRecentlySelectedEntityName: entityName })

        this.clearSearchInput()
    }

    @action.bound onClear(): void {
        const { partitionedSearchResults } = this
        if (this.searchInput) {
            const { selected = [] } = partitionedSearchResults ?? {}
            this.selectionArray.deselectEntities(
                selected.map((entity) => entity.name)
            )
        } else {
            this.selectionArray.clearSelection()
        }
    }

    @action.bound async loadPopulationColumn(): Promise<void> {
        if (this.populationColumn) return

        if (this.populationColumnUsedInChart) {
            this.set({ populationColumn: this.populationColumnUsedInChart })
            return
        }

        if (this.populationIndicatorId === undefined) return

        this.set({ isLoadingExternalSortColumn: true })

        try {
            const variable = await loadVariableDataAndMetadata(
                this.populationIndicatorId,
                this.manager.dataApiUrl
            )

            const variableTable = buildVariableTable(variable)
            if (variableTable) {
                this.set({
                    populationColumn: variableTable.get(this.populationSlug),
                })
            }
        } catch {
            console.error(
                `Failed to load variable with id ${this.populationIndicatorId}`
            )
        }

        this.set({ isLoadingExternalSortColumn: false })
    }

    @action.bound async loadGdpPerCapitaColumn(): Promise<void> {
        if (this.gdpPerCapitaColumn) return

        if (this.gdpPerCapitaColumnUsedInChart) {
            this.set({ gdpPerCapitaColumn: this.gdpPerCapitaColumnUsedInChart })
            return
        }

        if (this.gdpPerCapitaIndicatorId === undefined) return

        this.set({ isLoadingExternalSortColumn: true })

        try {
            const variable = await loadVariableDataAndMetadata(
                this.gdpPerCapitaIndicatorId,
                this.manager.dataApiUrl
            )
            const variableTable = buildVariableTable(variable)
            if (variableTable) {
                this.set({
                    gdpPerCapitaColumn: variableTable.get(
                        this.gdpPerCapitaSlug
                    ),
                })
            }
        } catch {
            console.error(
                `Failed to load variable with id ${this.gdpPerCapitaIndicatorId}`
            )
        }

        this.set({ isLoadingExternalSortColumn: false })
    }

    @action.bound async onChangeSortSlug(selected: unknown): Promise<void> {
        if (selected) {
            const { value } = selected as DropdownOption

            // if population or GDP per capita is selected, load the column
            // (this is a no-op if the column is already loaded)
            if (value === this.populationSlug) {
                await this.loadPopulationColumn()
            } else if (value === this.gdpPerCapitaSlug) {
                await this.loadGdpPerCapitaColumn()
            }

            this.updateSortSlug(value)
        }
    }

    @action.bound onChangeSortOrder(): void {
        this.toggleSortOrder()
    }

    private renderSearchBar(): JSX.Element {
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

    private renderSortBar(): JSX.Element {
        return (
            <div className="entity-selector__sort-bar">
                <span className="label grapher_label-2-medium">Sort by</span>
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

    private renderSearchResults(): JSX.Element {
        if (!this.searchResults || this.searchResults.length === 0) {
            return (
                <div className="entity-search-results grapher_body-3-regular">
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
                            local={entity.local}
                        />
                    </li>
                ))}
            </ul>
        )
    }

    private renderAllEntitiesInSingleMode(): JSX.Element {
        return (
            <ul>
                {this.sortedAvailableEntities.map((entity) => (
                    <li key={entity.name}>
                        <SelectableEntity
                            name={entity.name}
                            type="radio"
                            checked={this.isEntitySelected(entity)}
                            bar={this.getBarConfigForEntity(entity)}
                            onChange={() => this.onChange(entity.name)}
                            local={entity.local}
                        />
                    </li>
                ))}
            </ul>
        )
    }

    @computed private get displayColumn(): CoreColumn | undefined {
        const { sortConfig } = this
        if (this.isSortedByName) return undefined
        return this.sortColumnsBySlug[sortConfig.slug]
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

        const value = entity[displayColumn.slug]

        if (!isFiniteWithGuard(value)) return { formattedValue: "No data" }

        return {
            formattedValue: displayColumn.formatValueShort(value),
            width: clamp(barScale(value), 0, 1),
        }
    }

    private isEntitySelected(entity: SearchableEntity): boolean {
        return this.selectionArray.selectedSet.has(entity.name)
    }

    private renderAllEntitiesInMultiMode(): JSX.Element {
        const { selected, unselected } = this.partitionedAvailableEntities

        return (
            <Flipper
                spring={{
                    stiffness: 300,
                    damping: 33,
                }}
                flipKey={this.selectionArray.selectedEntityNames.join(",")}
            >
                <div className="entity-section">
                    {selected.length > 0 && (
                        <Flipped flipId="__selection" translate opacity>
                            <div className="entity-section__title grapher_body-3-medium-italic">
                                Selection
                            </div>
                        </Flipped>
                    )}
                    <ul>
                        {selected.map((entity) => (
                            <Flipped
                                key={entity.name}
                                flipId={entity.name}
                                translate
                                opacity
                            >
                                <li
                                    className={cx("animated-entity", {
                                        "most-recently-selected":
                                            this
                                                .mostRecentlySelectedEntityName ===
                                            entity.name,
                                    })}
                                >
                                    <SelectableEntity
                                        name={entity.name}
                                        type="checkbox"
                                        checked={true}
                                        bar={this.getBarConfigForEntity(entity)}
                                        onChange={() =>
                                            this.onChange(entity.name)
                                        }
                                        local={entity.local}
                                    />
                                </li>
                            </Flipped>
                        ))}
                    </ul>
                </div>

                <div className="entity-section">
                    {selected.length > 0 && unselected.length > 0 && (
                        <Flipped flipId="__available" translate opacity>
                            <div className="entity-section__title grapher_body-3-medium-italic grapher_light">
                                {capitalize(this.entityTypePlural)}
                            </div>
                        </Flipped>
                    )}

                    <ul>
                        {unselected.map((entity) => (
                            <Flipped
                                key={entity.name}
                                flipId={entity.name}
                                translate
                                opacity
                            >
                                <li
                                    className={cx("animated-entity", {
                                        "most-recently-selected":
                                            this
                                                .mostRecentlySelectedEntityName ===
                                            entity.name,
                                    })}
                                >
                                    <SelectableEntity
                                        name={entity.name}
                                        type="checkbox"
                                        checked={false}
                                        bar={this.getBarConfigForEntity(entity)}
                                        onChange={() =>
                                            this.onChange(entity.name)
                                        }
                                        local={entity.local}
                                    />
                                </li>
                            </Flipped>
                        ))}
                    </ul>
                </div>
            </Flipper>
        )
    }

    private renderFooter(): JSX.Element {
        const { numSelectedEntities, selectedEntityNames } = this.selectionArray
        const { partitionedVisibleEntities: visibleEntities } = this

        return (
            <div className="entity-selector__footer">
                {this.isMultiMode ? (
                    <>
                        <div className="footer__selected">
                            {numSelectedEntities > 0
                                ? `${numSelectedEntities} selected`
                                : "Empty selection"}
                        </div>
                        <button
                            type="button"
                            onClick={this.onClear}
                            disabled={visibleEntities.selected.length === 0}
                        >
                            Clear
                        </button>
                    </>
                ) : (
                    <div className="footer__selected footer__selected--no-wrap">
                        {selectedEntityNames.length > 0
                            ? `Current selection: ${selectedEntityNames[0]}`
                            : "Empty selection"}
                    </div>
                )}
            </div>
        )
    }

    render(): JSX.Element {
        return (
            <div
                ref={this.container}
                className={cx(GRAPHER_ENTITY_SELECTOR_CLASS, {
                    "entity-selector--single": !this.isMultiMode,
                })}
            >
                {this.renderSearchBar()}

                {!this.searchInput &&
                    this.sortOptions.length > 1 &&
                    this.renderSortBar()}

                <div className="entity-selector__content">
                    {this.searchInput
                        ? this.renderSearchResults()
                        : this.isMultiMode
                          ? this.renderAllEntitiesInMultiMode()
                          : this.renderAllEntitiesInSingleMode()}
                </div>

                {this.renderFooter()}
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
    local,
}: {
    name: React.ReactNode
    checked: boolean
    type: "checkbox" | "radio"
    bar?: BarConfig
    onChange: () => void
    local?: boolean
}) {
    const Input = {
        checkbox: Checkbox,
        radio: RadioButton,
    }[type]

    const label = local ? (
        <span className="label-with-location-icon">
            {name}
            <Tippy
                content="Your current location"
                theme="grapher-explanation--short"
                placement="top"
            >
                <FontAwesomeIcon icon={faLocationArrow} />
            </Tippy>
        </span>
    ) : (
        name
    )

    return (
        <div
            className="selectable-entity"
            // make the whole row clickable
            onClickCapture={(e) => {
                e.stopPropagation()
                e.preventDefault()
                onChange()
            }}
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

function makeColumnLabel(column: CoreColumn): string {
    return column.titlePublicOrDisplayName.title
}
