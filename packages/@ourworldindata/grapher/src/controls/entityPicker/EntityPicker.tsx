import React from "react"
import { action, computed, observable, runInAction, reaction } from "mobx"
import { observer } from "mobx-react"
import { Flipper, Flipped } from "react-flip-toolkit"
import { bind } from "decko"
import classnames from "classnames"
import { scaleLinear, ScaleLinear } from "d3-scale"
import Select from "react-select"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FuzzySearch } from "../../controls/FuzzySearch"
import {
    partition,
    scrollIntoViewIfNeeded,
    last,
    max,
    isNumber,
    sortByUndefinedLast,
    getStylesForTargetHeight,
    ColumnSlug,
} from "@ourworldindata/utils"
import { VerticalScrollContainer } from "../../controls/VerticalScrollContainer"
import { SortIcon } from "../../controls/SortIcon"
import {
    SortOrder,
    ColumnTypeMap,
    CoreColumn,
    EntityName,
    OwidTableSlugs,
    CoreColumnDef,
    OwidTable,
} from "@ourworldindata/core-table"
import { EntityPickerManager } from "./EntityPickerConstants"
import { SelectionArray } from "../../selection/SelectionArray"

const toggleSort = (order: SortOrder): SortOrder =>
    order === SortOrder.desc ? SortOrder.asc : SortOrder.desc

enum FocusDirection {
    first = "first",
    last = "last",
    up = "up",
    down = "down",
}

interface EntityOptionWithMetricValue {
    entityName: EntityName
    plotValue: number | string | undefined
    formattedValue: any
}

/** Modulo that wraps negative numbers too */
const mod = (n: number, m: number): number => ((n % m) + m) % m

@observer
export class EntityPicker extends React.Component<{
    manager: EntityPickerManager
    isDropdownMenu?: boolean
}> {
    @computed private get analyticsNamespace(): string {
        return this.manager.analyticsNamespace ?? ""
    }

    @observable private searchInput?: string
    @observable
    private searchInputRef: React.RefObject<HTMLInputElement> =
        React.createRef()

    @observable private focusIndex?: number
    @observable
    private focusRef: React.RefObject<HTMLLabelElement> = React.createRef()
    @observable private scrollFocusedIntoViewOnUpdate = false

    @observable private blockOptionHover = false

    @observable
    private scrollContainerRef: React.RefObject<HTMLDivElement> =
        React.createRef()

    @observable private isOpen = false

    @computed private get isDropdownMenu(): boolean {
        return !!this.props.isDropdownMenu
    }

    @action.bound private selectEntity(
        name: EntityName,
        checked?: boolean
    ): void {
        this.manager.selection.toggleSelection(name)
        // Clear search input
        this.searchInput = ""
        this.manager.analytics?.logEntityPickerEvent(
            this.analyticsNamespace,
            checked ? "select" : "deselect",
            name
        )
    }

    @computed private get manager(): EntityPickerManager {
        return this.props.manager
    }

    @computed private get metric(): string | undefined {
        return this.manager.entityPickerMetric
    }

    @computed private get sortOrder(): SortOrder {
        // On mobile, only allow sorting by entityName (ascending)
        if (this.isDropdownMenu) return SortOrder.asc
        return this.manager.entityPickerSort ?? SortOrder.asc
    }

    @computed private get pickerColumnDefs(): CoreColumnDef[] {
        return this.manager.entityPickerColumnDefs ?? []
    }

    @computed private get metricOptions(): { label: string; value: string }[] {
        return this.pickerColumnDefs.map(
            (
                col
            ): {
                label: string
                value: string
            } => {
                return {
                    label: col.name || col.slug,
                    value: col.slug,
                }
            }
        )
    }

    private getColumn(slug: ColumnSlug | undefined): CoreColumn | undefined {
        if (slug === undefined) return undefined
        return this.manager.entityPickerTable?.get(slug)
    }

    @computed private get activePickerMetricColumn(): CoreColumn | undefined {
        return this.getColumn(this.metric)
    }

    @computed private get availableEntitiesForCurrentView(): Set<string> {
        if (!this.grapherTable) return this.selection.availableEntityNameSet
        if (!this.manager.requiredColumnSlugs?.length)
            return this.grapherTable.availableEntityNameSet
        return this.grapherTable.entitiesWith(this.manager.requiredColumnSlugs)
    }

    @computed
    private get entitiesWithMetricValue(): EntityOptionWithMetricValue[] {
        const { pickerTable, selection } = this
        const col = this.activePickerMetricColumn
        const entityNames = selection.availableEntityNames.slice().sort()
        return entityNames.map((entityName) => {
            const plotValue =
                col && pickerTable
                    ? (pickerTable.getLatestValueForEntity(
                          entityName,
                          col.slug
                      ) as string | number)
                    : undefined

            const formattedValue =
                plotValue !== undefined
                    ? col?.formatValueShortWithAbbreviations(plotValue)
                    : undefined
            return {
                entityName,
                plotValue,
                formattedValue,
            }
        })
    }

    @computed private get grapherTable(): OwidTable | undefined {
        return this.manager.grapherTable
    }

    @computed private get pickerTable(): OwidTable | undefined {
        return this.manager.entityPickerTable
    }

    @computed get selection(): SelectionArray {
        return this.manager.selection
    }

    @computed get selectionSet(): Set<string> {
        return new Set(this.selection.selectedEntityNames)
    }

    @computed private get fuzzy(): FuzzySearch<EntityOptionWithMetricValue> {
        return new FuzzySearch(
            this.entitiesWithMetricValue,
            OwidTableSlugs.entityName
        )
    }

    @computed private get searchResults(): EntityOptionWithMetricValue[] {
        if (this.searchInput) return this.fuzzy.search(this.searchInput)
        const { selectionSet } = this
        // Show the selected up top and in order.
        const [selected, unselected] = partition(
            sortByUndefinedLast(
                this.entitiesWithMetricValue,
                (option) => option.plotValue,
                this.sortOrder
            ),
            (option: EntityOptionWithMetricValue): boolean =>
                selectionSet.has(option.entityName)
        )
        return [...selected, ...unselected]
    }

    private normalizeFocusIndex(index: number): number | undefined {
        if (this.searchResults.length === 0) return undefined
        return mod(index, this.searchResults.length)
    }

    @computed private get focusedOption(): string | undefined {
        return this.focusIndex !== undefined
            ? this.searchResults[this.focusIndex].entityName
            : undefined
    }

    @computed private get showDoneButton(): boolean {
        return this.isDropdownMenu && this.isOpen
    }

    @action.bound private focusOptionDirection(
        direction: FocusDirection
    ): void {
        if (direction === FocusDirection.first)
            this.focusIndex = this.normalizeFocusIndex(0)
        else if (direction === FocusDirection.last)
            this.focusIndex = this.normalizeFocusIndex(-1)
        else if (direction === FocusDirection.up) {
            const newIndex =
                this.focusIndex === undefined ? -1 : this.focusIndex - 1
            this.focusIndex = this.normalizeFocusIndex(newIndex)
        } else if (direction === FocusDirection.down) {
            const newIndex =
                this.focusIndex === undefined ? 0 : this.focusIndex + 1
            this.focusIndex = this.normalizeFocusIndex(newIndex)
        } else return // Exit without updating scroll
        this.scrollFocusedIntoViewOnUpdate = true
    }

    @action.bound private clearSearchInput(): void {
        if (this.searchInput) this.searchInput = ""
    }

    @action.bound private onKeyDown(
        event: React.KeyboardEvent<HTMLDivElement>
    ): void {
        // We want to block hover if a key is pressed.
        // The hover will be unblocked iff the user moves the mouse (relative to the menu).
        this.blockHover()
        switch (event.key) {
            case "Enter":
                if (event.keyCode === 229) {
                    // ignore the keydown event from an Input Method Editor(IME)
                    // ref. https://www.w3.org/TR/uievents/#determine-keydown-keyup-keyCode
                    break
                }
                if (!this.focusedOption) return
                const name = this.focusedOption
                this.selectEntity(name)
                this.clearSearchInput()
                this.manager.analytics?.logEntityPickerEvent(
                    this.analyticsNamespace,
                    "enter",
                    name
                )
                break
            case "ArrowUp":
                this.focusOptionDirection(FocusDirection.up)
                break
            case "ArrowDown":
                this.focusOptionDirection(FocusDirection.down)
                break
            default:
                return
        }
        event.preventDefault()
    }

    @bind private focusSearch(): void {
        this.searchInputRef.current?.focus()
    }

    @action.bound private onSearchFocus(): void {
        this.isOpen = true
        if (this.focusIndex === undefined)
            this.focusOptionDirection(FocusDirection.first)
    }

    @action.bound private onSearchBlur(): void {
        // Do not allow focus on elements inside menu; shift focus back to search input.
        if (
            this.scrollContainerRef.current &&
            this.scrollContainerRef.current.contains(document.activeElement)
        ) {
            this.focusSearch()
            return
        }
        this.isOpen = false
        this.focusIndex = undefined
    }

    @action.bound private onHover(index: number): void {
        if (!this.blockOptionHover) this.focusIndex = index
    }

    @action.bound private blockHover(): void {
        this.blockOptionHover = true
    }

    @action.bound private unblockHover(): void {
        this.blockOptionHover = false
    }

    @action.bound private onMenuMouseDown(
        event: React.MouseEvent<HTMLDivElement, MouseEvent>
    ): void {
        event.stopPropagation()
        event.preventDefault()
        this.focusSearch()
    }

    @bind private highlightLabel(label: string): string | JSX.Element {
        if (!this.searchInput) return label

        const result = this.fuzzy.single(this.searchInput, label)
        if (!result) return label

        const tokens: { match: boolean; text: string }[] = []
        for (let i = 0; i < result.target.length; i++) {
            const currentToken = last(tokens)
            const match = result.indexes.includes(i)
            const char = result.target[i]
            if (!currentToken || currentToken.match !== match) {
                tokens.push({
                    match,
                    text: char,
                })
            } else currentToken.text += char
        }
        return (
            <span translate="no">
                {tokens.map((token, i) =>
                    token.match ? (
                        <mark key={i}>{token.text}</mark>
                    ) : (
                        <span key={i}>{token.text}</span>
                    )
                )}
            </span>
        )
    }

    @computed private get barScale(): ScaleLinear<number, number> {
        const maxValue = max(
            this.entitiesWithMetricValue
                .map((option) => option.plotValue)
                .filter(isNumber)
        )
        return scaleLinear()
            .domain([0, maxValue ?? 1])
            .range([0, 1])
    }

    componentDidMount(): void {
        // Whenever the search term changes, shift focus to first option in the list
        reaction(
            () => this.searchInput,
            () => this.focusOptionDirection(FocusDirection.first)
        )
    }

    componentDidUpdate(): void {
        if (
            this.focusIndex !== undefined &&
            this.scrollFocusedIntoViewOnUpdate &&
            this.scrollContainerRef.current &&
            this.focusRef.current
        ) {
            scrollIntoViewIfNeeded(
                this.scrollContainerRef.current,
                this.focusRef.current
            )
            runInAction(() => (this.scrollFocusedIntoViewOnUpdate = false))
        }
    }

    @action private updateMetric(columnSlug: ColumnSlug): void {
        const col = this.getColumn(columnSlug)

        this.manager.setEntityPicker?.({
            metric: columnSlug,
            sort: this.isColumnTypeNumeric(col)
                ? SortOrder.desc
                : SortOrder.asc,
        })
        this.manager.analytics?.logEntityPickerEvent(
            this.analyticsNamespace,
            "sortBy",
            columnSlug
        )
    }

    private isColumnTypeNumeric(col: CoreColumn | undefined): boolean {
        // If the column is currently missing (not loaded yet), assume it is numeric.
        return (
            col === undefined ||
            col.isMissing ||
            col instanceof ColumnTypeMap.Numeric
        )
    }

    private get pickerMenu(): JSX.Element | null {
        if (
            this.isDropdownMenu ||
            !this.manager.entityPickerColumnDefs ||
            this.manager.entityPickerColumnDefs.length === 0
        )
            return null
        return (
            <div className="MetricSettings">
                <span className="mainLabel">Sort by</span>
                <Select
                    className="metricDropdown"
                    options={this.metricOptions}
                    value={this.metricOptions.find(
                        (option) => option.value === this.metric
                    )}
                    onChange={(option): void => {
                        if (option) this.updateMetric(option.value)
                    }}
                    menuPlacement="bottom"
                    components={{
                        IndicatorSeparator: null,
                    }}
                    styles={getStylesForTargetHeight(26)}
                    isSearchable={false}
                    isLoading={this.manager.entityPickerTableIsLoading}
                />
                <span
                    className="sort"
                    onClick={(): void => {
                        const sortOrder = toggleSort(this.sortOrder)
                        this.manager.setEntityPicker?.({ sort: sortOrder })
                        this.manager.analytics?.logEntityPickerEvent(
                            this.analyticsNamespace,
                            "sortOrder",
                            sortOrder
                        )
                    }}
                >
                    <SortIcon
                        type={
                            this.isColumnTypeNumeric(
                                this.activePickerMetricColumn
                            )
                                ? "numeric"
                                : "text"
                        }
                        order={this.sortOrder}
                    />
                </span>
            </div>
        )
    }

    render(): JSX.Element {
        const { selection } = this
        const entities = this.searchResults
        const selectedEntityNames = selection.selectedEntityNames
        const availableEntities = this.availableEntitiesForCurrentView

        const selectedDebugMessage = `${selectedEntityNames.length} selected. ${availableEntities.size} available. ${this.entitiesWithMetricValue.length} options total.`

        const entityType = selection.entityType
        return (
            <div className="EntityPicker" onKeyDown={this.onKeyDown}>
                <div className="EntityPickerSearchInput">
                    <input
                        className={classnames("input-field", {
                            "with-done-button": this.showDoneButton,
                        })}
                        type="text"
                        placeholder={`Type to add a ${entityType}...`}
                        value={this.searchInput ?? ""}
                        onChange={(e): string =>
                            (this.searchInput = e.currentTarget.value)
                        }
                        onFocus={this.onSearchFocus}
                        onBlur={this.onSearchBlur}
                        ref={this.searchInputRef}
                        data-track-note={`${this.analyticsNamespace}-picker-search-input`}
                    />
                    <div className="search-icon">
                        <FontAwesomeIcon icon={faSearch} />
                    </div>
                    {this.showDoneButton && (
                        <div className="done">
                            <button>Done</button>
                        </div>
                    )}
                </div>
                {this.pickerMenu}
                <div className="EntityListContainer">
                    {(!this.isDropdownMenu || this.isOpen) && (
                        <div
                            className={classnames("EntityList", {
                                isDropdown: this.isDropdownMenu,
                            })}
                            onMouseDown={this.onMenuMouseDown}
                        >
                            <VerticalScrollContainer
                                scrollingShadows={true}
                                scrollLock={true}
                                className="EntitySearchResults"
                                contentsId={entities
                                    .map((c) => c.entityName)
                                    .join(",")}
                                onMouseMove={this.unblockHover}
                                ref={this.scrollContainerRef}
                            >
                                <Flipper
                                    spring={{
                                        stiffness: 300,
                                        damping: 33,
                                    }}
                                    // We only want to animate when the selection changes, but not on changes due to
                                    // searching
                                    flipKey={selectedEntityNames.join(",")}
                                >
                                    {entities.map((option, index) => (
                                        <PickerOption
                                            key={index}
                                            hasDataForActiveMetric={availableEntities.has(
                                                option.entityName
                                            )}
                                            optionWithMetricValue={option}
                                            highlight={this.highlightLabel}
                                            barScale={this.barScale}
                                            onChange={this.selectEntity}
                                            onHover={(): void =>
                                                this.onHover(index)
                                            }
                                            isSelected={this.selectionSet.has(
                                                option.entityName
                                            )}
                                            isFocused={
                                                this.focusIndex === index
                                            }
                                            innerRef={
                                                this.focusIndex === index
                                                    ? this.focusRef
                                                    : undefined
                                            }
                                        />
                                    ))}
                                </Flipper>
                            </VerticalScrollContainer>
                            <div>
                                <div
                                    title={selectedDebugMessage}
                                    className="ClearSelectionButton"
                                    data-track-note={`${this.analyticsNamespace}-clear-selection`}
                                    onClick={(): void =>
                                        selection.clearSelection()
                                    }
                                >
                                    <FontAwesomeIcon icon={faTimes} /> Clear
                                    selection
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }
}

interface PickerOptionProps {
    optionWithMetricValue: EntityOptionWithMetricValue
    highlight: (label: string) => JSX.Element | string
    onChange: (name: string, checked: boolean) => void
    onHover?: () => void
    innerRef?: React.RefObject<HTMLLabelElement>
    isFocused?: boolean
    isSelected?: boolean
    barScale?: ScaleLinear<number, number>
    hasDataForActiveMetric: boolean
}

class PickerOption extends React.Component<PickerOptionProps> {
    @bind onClick(event: React.MouseEvent<HTMLLabelElement, MouseEvent>): void {
        event.stopPropagation()
        event.preventDefault()
        this.props.onChange(
            this.props.optionWithMetricValue.entityName,
            !this.props.isSelected
        )
    }

    render(): JSX.Element {
        const {
            barScale,
            optionWithMetricValue,
            innerRef,
            isSelected,
            isFocused,
            hasDataForActiveMetric,
            highlight,
        } = this.props
        const { entityName, plotValue, formattedValue } = optionWithMetricValue
        const metricValue = formattedValue === entityName ? "" : formattedValue // If the user has this entity selected, don't show the name twice.

        return (
            <Flipped flipId={entityName} translate opacity>
                <label
                    className={classnames(
                        "EntityPickerOption",
                        {
                            selected: isSelected,
                            focused: isFocused,
                        },
                        hasDataForActiveMetric ? undefined : "MissingData"
                    )}
                    onMouseMove={this.props.onHover}
                    onMouseOver={this.props.onHover}
                    onClick={this.onClick}
                    ref={innerRef}
                >
                    <div className="input-container">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            value={entityName}
                            tabIndex={-1}
                            readOnly
                        />
                    </div>
                    <div className="info-container">
                        <div className="labels-container">
                            <div className="name">{highlight(entityName)}</div>
                            {plotValue !== undefined && (
                                <div className="metric">{metricValue}</div>
                            )}
                        </div>
                        {barScale && isNumber(plotValue) ? (
                            <div className="plot">
                                <div
                                    className="bar"
                                    style={{
                                        width: `${barScale(plotValue) * 100}%`,
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="plot"></div>
                        )}
                    </div>
                </label>
            </Flipped>
        )
    }
}
