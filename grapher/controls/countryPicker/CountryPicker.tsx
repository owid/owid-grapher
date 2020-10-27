import React from "react"
import { action, computed, observable, runInAction, reaction } from "mobx"
import { observer } from "mobx-react"
import { Flipper, Flipped } from "react-flip-toolkit"
import { bind } from "decko"
import classnames from "classnames"
import { scaleLinear, ScaleLinear } from "d3-scale"
import Select from "react-select"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FuzzySearch } from "grapher/controls/FuzzySearch"
import {
    partition,
    scrollIntoViewIfNeeded,
    last,
    max,
    isNumber,
    sortBy,
    sortByUndefinedLast,
    first,
} from "grapher/utils/Util"
import { VerticalScrollContainer } from "grapher/controls/VerticalScrollContainer"
import { SortIcon } from "grapher/controls/SortIcon"
import { ColumnSlug, SortOrder } from "coreTable/CoreTableConstants"
import { getStylesForTargetHeight, asArray } from "utils/client/react-select"
import { ColumnTypeMap } from "coreTable/CoreTableColumns"
import { EntityName, OwidTableSlugs } from "coreTable/OwidTableConstants"
import { CountryPickerManager } from "./CountryPickerConstants"

const toggleSort = (order: SortOrder) =>
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
const mod = (n: number, m: number) => ((n % m) + m) % m

@observer
export class CountryPicker extends React.Component<{
    manager?: CountryPickerManager
    isDropdownMenu?: boolean
}> {
    @computed private get analyticsNamespace() {
        return this.manager.analyticsNamespace ?? ""
    }

    @observable private searchInput?: string
    @observable private searchInputRef: React.RefObject<
        HTMLInputElement
    > = React.createRef()

    @observable private focusIndex?: number
    @observable private focusRef: React.RefObject<
        HTMLLabelElement
    > = React.createRef()
    @observable private scrollFocusedIntoViewOnUpdate = false

    @observable private blockOptionHover = false

    @observable private scrollContainerRef: React.RefObject<
        HTMLDivElement
    > = React.createRef()

    @observable private isOpen = false

    @computed private get isDropdownMenu() {
        return !!this.props.isDropdownMenu
    }

    @action.bound private selectEntity(name: EntityName, checked?: boolean) {
        this.manager.selectionArray.toggleSelection(name)
        // Clear search input
        this.searchInput = ""
        this.manager.analytics?.logCountrySelectorEvent(
            this.analyticsNamespace,
            checked ? "select" : "deselect",
            name
        )
    }

    @computed private get manager() {
        return this.props.manager || ({} as CountryPickerManager)
    }

    @computed private get metric() {
        return this.manager.countryPickerMetric
    }

    @computed private get sortOrder(): SortOrder {
        // On mobile, only allow sorting by entityName (ascending)
        if (this.isDropdownMenu) return SortOrder.asc
        return this.manager.countryPickerSort ?? SortOrder.asc
    }

    @computed private get availablePickerColumns() {
        if (!this.manager.pickerColumnSlugs) return []
        const slugsToShow = new Set(this.manager.pickerColumnSlugs)
        return this.table.columnsAsArray.filter((col) =>
            slugsToShow.has(col.slug)
        )
    }

    @computed private get metricOptions() {
        return sortBy(
            this.availablePickerColumns.map((col) => {
                return {
                    label: col.name,
                    value: col.slug,
                }
            }),
            "label"
        )
    }

    @computed private get activePickerMetricColumn() {
        return this.availablePickerColumns.find(
            (col) => col.slug === this.metric
        )!
    }

    @computed private get availableEntitiesForCurrentView() {
        if (!this.manager.requiredColumnSlugs?.length)
            return this.selectionArray.availableEntityNameSet
        return this.table.entitiesWith(this.manager.requiredColumnSlugs)
    }

    @computed
    private get entitiesWithMetricValue(): EntityOptionWithMetricValue[] {
        const { table, selectionArray } = this
        const col = this.activePickerMetricColumn
        const entityNames = selectionArray.availableEntityNames.slice().sort()
        return entityNames.map((entityName) => {
            const plotValue = col
                ? (table.getLatestValueForEntity(entityName, col.slug) as
                      | string
                      | number)
                : undefined

            const formattedValue =
                plotValue !== undefined
                    ? col?.formatValue(plotValue)
                    : undefined
            return {
                entityName,
                plotValue,
                formattedValue,
            }
        })
    }

    @computed private get table() {
        return this.manager.countryPickerTable
    }

    @computed get selectionArray() {
        return this.manager.selectionArray
    }

    @bind private isSelected(option: EntityOptionWithMetricValue) {
        return this.selectionArray.selectedEntityNames.includes(
            option.entityName
        )
    }

    @computed private get fuzzy(): FuzzySearch<EntityOptionWithMetricValue> {
        return new FuzzySearch(
            this.entitiesWithMetricValue,
            OwidTableSlugs.entityName
        )
    }

    @computed private get searchResults(): EntityOptionWithMetricValue[] {
        if (this.searchInput) return this.fuzzy.search(this.searchInput)

        // Show the selected up top and in order.
        const [selected, unselected] = partition(
            sortByUndefinedLast(
                this.entitiesWithMetricValue,
                (option) => option.plotValue,
                this.sortOrder
            ),
            this.isSelected
        )
        return [...selected, ...unselected]
    }

    private normalizeFocusIndex(index: number) {
        if (this.searchResults.length === 0) return undefined
        return mod(index, this.searchResults.length)
    }

    @computed private get focusedOption() {
        return this.focusIndex !== undefined
            ? this.searchResults[this.focusIndex].entityName
            : undefined
    }

    @computed private get showDoneButton() {
        return this.isDropdownMenu && this.isOpen
    }

    @action.bound private focusOptionDirection(direction: FocusDirection) {
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

    @action.bound private clearSearchInput() {
        if (this.searchInput) this.searchInput = ""
    }

    @action.bound private onKeyDown(
        event: React.KeyboardEvent<HTMLDivElement>
    ) {
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
                this.manager.analytics?.logCountrySelectorEvent(
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

    @bind private focusSearch() {
        this.searchInputRef.current?.focus()
    }

    @action.bound private onSearchFocus() {
        this.isOpen = true
        if (this.focusIndex === undefined)
            this.focusOptionDirection(FocusDirection.first)
    }

    @action.bound private onSearchBlur() {
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

    @action.bound private onHover(index: number) {
        if (!this.blockOptionHover) this.focusIndex = index
    }

    @action.bound private blockHover() {
        this.blockOptionHover = true
    }

    @action.bound private unblockHover() {
        this.blockOptionHover = false
    }

    @action.bound private onMenuMouseDown(
        event: React.MouseEvent<HTMLDivElement, MouseEvent>
    ) {
        event.stopPropagation()
        event.preventDefault()
        this.focusSearch()
    }

    @bind private highlightLabel(label: string) {
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
            <React.Fragment>
                {tokens.map((token, i) =>
                    token.match ? (
                        <mark key={i}>{token.text}</mark>
                    ) : (
                        <React.Fragment key={i}>{token.text}</React.Fragment>
                    )
                )}
            </React.Fragment>
        )
    }

    @computed private get barScale() {
        const maxValue = max(
            this.entitiesWithMetricValue
                .map((option) => option.plotValue)
                .filter(isNumber)
        )
        return scaleLinear()
            .domain([0, maxValue ?? 1])
            .range([0, 1])
    }

    componentDidMount() {
        // Whenever the search term changes, shift focus to first option in the list
        reaction(
            () => this.searchInput,
            () => this.focusOptionDirection(FocusDirection.first)
        )
    }

    componentDidUpdate() {
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

    @action private updateMetric(columnSlug: ColumnSlug) {
        this.manager.countryPickerMetric = columnSlug
        this.manager.countryPickerSort = this.isActivePickerColumnTypeNumeric
            ? SortOrder.desc
            : SortOrder.asc
        this.manager.analytics?.logCountrySelectorEvent(
            this.analyticsNamespace,
            "sortBy",
            columnSlug
        )
    }

    @computed private get isActivePickerColumnTypeNumeric() {
        return this.activePickerMetricColumn instanceof ColumnTypeMap.Numeric
    }

    private get pickerMenu() {
        if (this.isDropdownMenu) return null
        if (!this.manager.pickerColumnSlugs) return null
        return (
            <div className="MetricSettings">
                <span className="mainLabel">Sort by</span>
                <Select
                    className="metricDropdown"
                    options={this.metricOptions}
                    value={this.metricOptions.find(
                        (option) => option.value === this.metric
                    )}
                    onChange={(option) => {
                        const value = first(asArray(option))?.value
                        if (value) this.updateMetric(value)
                    }}
                    menuPlacement="bottom"
                    components={{
                        IndicatorSeparator: null,
                    }}
                    styles={getStylesForTargetHeight(26)}
                    isSearchable={false}
                />
                <span
                    className="sort"
                    onClick={() => {
                        const sortOrder = toggleSort(this.sortOrder)
                        this.manager.countryPickerSort = sortOrder
                        this.manager.analytics?.logCountrySelectorEvent(
                            this.analyticsNamespace,
                            "sortOrder",
                            sortOrder
                        )
                    }}
                >
                    <SortIcon
                        type={
                            this.isActivePickerColumnTypeNumeric
                                ? "numeric"
                                : "text"
                        }
                        order={this.sortOrder}
                    />
                </span>
            </div>
        )
    }

    render() {
        const entities = this.searchResults
        const selectedEntityNames = this.selectionArray.selectedEntityNames
        const availableEntities = this.availableEntitiesForCurrentView
        const colorMap = this.manager.entityColorMap || {}

        const selectedDebugMessage = `${selectedEntityNames.length} selected. ${availableEntities.size} available. ${this.entitiesWithMetricValue.length} options total.`

        return (
            <div className="CountryPicker" onKeyDown={this.onKeyDown}>
                <div className="CountryPickerSearchInput">
                    <input
                        className={classnames("input-field", {
                            "with-done-button": this.showDoneButton,
                        })}
                        type="text"
                        placeholder="Type to add a country..."
                        value={this.searchInput ?? ""}
                        onChange={(e) =>
                            (this.searchInput = e.currentTarget.value)
                        }
                        onFocus={this.onSearchFocus}
                        onBlur={this.onSearchBlur}
                        ref={this.searchInputRef}
                        data-track-note={`${this.analyticsNamespace}-country-search-input`}
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
                <div className="CountryListContainer">
                    {(!this.isDropdownMenu || this.isOpen) && (
                        <div
                            className={classnames("CountryList", {
                                isDropdown: this.isDropdownMenu,
                            })}
                            onMouseDown={this.onMenuMouseDown}
                        >
                            <VerticalScrollContainer
                                scrollingShadows={true}
                                scrollLock={true}
                                className="CountrySearchResults"
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
                                            color={colorMap[option.entityName]}
                                            onChange={this.selectEntity}
                                            onHover={() => this.onHover(index)}
                                            isSelected={this.isSelected(option)}
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
                            <div className="CountrySelectionControls">
                                <div
                                    title={selectedDebugMessage}
                                    className="ClearSelectionButton"
                                    data-track-note={`${this.analyticsNamespace}-clear-selection`}
                                    onClick={() =>
                                        this.selectionArray.clearSelection()
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

interface CountryOptionProps {
    optionWithMetricValue: EntityOptionWithMetricValue
    highlight: (label: string) => JSX.Element | string
    onChange: (name: string, checked: boolean) => void
    onHover?: () => void
    innerRef?: React.RefObject<HTMLLabelElement>
    isFocused?: boolean
    isSelected?: boolean
    barScale?: ScaleLinear<number, number>
    color?: string
    hasDataForActiveMetric: boolean
}

class PickerOption extends React.Component<CountryOptionProps> {
    @bind onClick(event: React.MouseEvent<HTMLLabelElement, MouseEvent>) {
        event.stopPropagation()
        event.preventDefault()
        this.props.onChange(
            this.props.optionWithMetricValue.entityName,
            !this.props.isSelected
        )
    }

    render() {
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
        const metricValue = formattedValue === entityName ? "" : formattedValue // If the user has "country name" selected, don't show the name twice.

        return (
            <Flipped flipId={entityName} translate opacity>
                <label
                    className={classnames(
                        "CountryOption",
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
