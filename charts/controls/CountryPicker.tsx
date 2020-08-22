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

import { FuzzySearch } from "charts/controls/FuzzySearch"
import {
    partition,
    scrollIntoViewIfNeeded,
    last,
    max,
    isNumber,
    sortBy,
    sortByUndefinedLast,
    first
} from "charts/Util"
import { VerticalScrollContainer } from "charts/VerticalScrollContainer"
import { Analytics } from "site/client/Analytics"

import { SortIcon } from "charts/SortIcon"
import { toggleSort, SortOrder } from "charts/SortOrder"
import { getStylesForTargetHeight, asArray } from "utils/client/react-select"
import {
    AbstractColumn,
    OwidTable,
    NumericColumn
} from "../../owidTable/OwidTable"

enum FocusDirection {
    first = "first",
    last = "last",
    up = "up",
    down = "down"
}

interface CountryOptionWithMetricValue {
    name: string
    plotValue: number | string | undefined
    formattedValue: any
}

/** Modulo that wraps negative numbers too */
function mod(n: number, m: number) {
    return ((n % m) + m) % m
}

interface MetricState {
    countryPickerMetric: string
    countryPickerSort: SortOrder
    selectedCountryCodes: Set<string>
}

@observer
export class CountryPicker extends React.Component<{
    explorerSlug: string
    table: OwidTable
    optionColorMap: {
        [key: string]: string | undefined
    }
    toggleCountryCommand: (countryName: string, value?: boolean) => void
    clearSelectionCommand: () => void
    availableEntities: string[]
    selectedEntities: string[]
    userState: MetricState
    isDropdownMenu?: boolean
    countriesMustHaveColumns: string[]
    pickerColumnSlugs: Set<string>
}> {
    // Set default props
    static defaultProps = {
        explorerSlug: "",
        table: new OwidTable([]),
        optionColorMap: {},
        toggleCountryCommand: () => {},
        clearSelectionCommand: () => {},
        userState: {},
        isDropdownMenu: false,
        availableEntities: [],
        selectedEntities: [],
        countriesMustHaveColumns: [],
        pickerColumnSlugs: new Set()
    }

    @observable private searchInput?: string
    @observable private searchInputRef: React.RefObject<
        HTMLInputElement
    > = React.createRef()

    @observable private focusIndex?: number
    @observable private focusRef: React.RefObject<
        HTMLLabelElement
    > = React.createRef()
    @observable private scrollFocusedIntoViewOnUpdate: boolean = false

    @observable private blockOptionHover: boolean = false

    @observable private scrollContainerRef: React.RefObject<
        HTMLDivElement
    > = React.createRef()

    @observable private isOpen: boolean = false

    @computed private get isDropdownMenu(): boolean {
        return !!this.props.isDropdownMenu
    }

    @action.bound private selectCountryName(name: string, checked?: boolean) {
        this.props.toggleCountryCommand(name, checked)
        // Clear search input
        this.searchInput = ""
        Analytics.logCountrySelectorEvent(
            this.props.explorerSlug,
            checked ? "select" : "deselect",
            name
        )
    }

    @computed get metric(): string {
        // On mobile, only allow sorting by location
        return this.props.userState.countryPickerMetric
    }

    @computed get sortOrder(): SortOrder {
        // On mobile, only allow sorting by location (ascending)
        if (this.isDropdownMenu) return SortOrder.asc
        return this.props.userState.countryPickerSort
    }

    @computed get availablePickerColumns() {
        return this.props.table.columnsAsArray.filter(col =>
            this.props.pickerColumnSlugs.has(col.slug)
        )
    }

    @computed get metricOptions() {
        return sortBy(
            this.availablePickerColumns.map(col => {
                return {
                    label: col.spec.name, // todo: name
                    value: col.slug
                }
            }),
            "label"
        )
    }

    @computed get activePickerMetricColumn(): AbstractColumn {
        return this.availablePickerColumns.find(
            col => col.slug === this.metric
        )!
    }

    @computed get availableCountriesForCurrentView() {
        if (!this.props.countriesMustHaveColumns.length)
            return this.props.table.availableEntitiesSet
        return this.props.table.entitiesWith(
            this.props.countriesMustHaveColumns
        )
    }

    @computed
    private get optionsWithMetricValue(): CountryOptionWithMetricValue[] {
        const col = this.activePickerMetricColumn
        return this.props.availableEntities.map(name => {
            const plotValue = col?.getLatestValueForEntity(name)
            const formattedValue = col?.formatValue(plotValue)
            return {
                name,
                plotValue,
                formattedValue
            }
        })
    }

    @bind private isSelected(option: CountryOptionWithMetricValue) {
        return this.props.selectedEntities.includes(option.name)
    }

    @computed private get fuzzy(): FuzzySearch<CountryOptionWithMetricValue> {
        return new FuzzySearch(this.optionsWithMetricValue, "name")
    }

    @computed private get searchResults(): CountryOptionWithMetricValue[] {
        if (this.searchInput) {
            return this.fuzzy.search(this.searchInput)
        }
        // Show the selected up top and in order.
        const [selected, unselected] = partition(
            sortByUndefinedLast(
                this.optionsWithMetricValue,
                option => option.plotValue,
                this.sortOrder
            ),
            this.isSelected
        )
        return [...selected, ...unselected]
    }

    private normalizeFocusIndex(index: number): number | undefined {
        if (this.searchResults.length === 0) return undefined
        return mod(index, this.searchResults.length)
    }

    @computed private get focusedOption(): string | undefined {
        return this.focusIndex !== undefined
            ? this.searchResults[this.focusIndex].name
            : undefined
    }

    @computed private get showDoneButton(): boolean {
        return this.isDropdownMenu && this.isOpen
    }

    @action.bound private focusOptionDirection(direction: FocusDirection) {
        if (direction === FocusDirection.first) {
            this.focusIndex = this.normalizeFocusIndex(0)
        } else if (direction === FocusDirection.last) {
            this.focusIndex = this.normalizeFocusIndex(-1)
        } else if (direction === FocusDirection.up) {
            const newIndex =
                this.focusIndex === undefined ? -1 : this.focusIndex - 1
            this.focusIndex = this.normalizeFocusIndex(newIndex)
        } else if (direction === FocusDirection.down) {
            const newIndex =
                this.focusIndex === undefined ? 0 : this.focusIndex + 1
            this.focusIndex = this.normalizeFocusIndex(newIndex)
        } else {
            // Exit without updating scroll
            return
        }
        this.scrollFocusedIntoViewOnUpdate = true
    }

    @action.bound private clearSearchInput() {
        if (this.searchInput) {
            this.searchInput = ""
        }
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
                this.selectCountryName(name)
                this.clearSearchInput()
                Analytics.logCountrySelectorEvent(
                    this.props.explorerSlug,
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

    @bind focusSearch() {
        this.searchInputRef.current?.focus()
    }

    @action.bound private onSearchFocus() {
        this.isOpen = true
        if (this.focusIndex === undefined) {
            this.focusOptionDirection(FocusDirection.first)
        }
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
        if (!this.blockOptionHover) {
            this.focusIndex = index
        }
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

    @bind private highlightLabel(label: string): JSX.Element | string {
        if (this.searchInput) {
            const result = this.fuzzy.single(this.searchInput, label)
            if (result) {
                const tokens: { match: boolean; text: string }[] = []
                for (let i = 0; i < result.target.length; i++) {
                    const currentToken = last(tokens)
                    const match = result.indexes.includes(i)
                    const char = result.target[i]
                    if (!currentToken || currentToken.match !== match) {
                        tokens.push({
                            match,
                            text: char
                        })
                    } else {
                        currentToken.text += char
                    }
                }
                return (
                    <React.Fragment>
                        {tokens.map((token, i) =>
                            token.match ? (
                                <mark key={i}>{token.text}</mark>
                            ) : (
                                <React.Fragment key={i}>
                                    {token.text}
                                </React.Fragment>
                            )
                        )}
                    </React.Fragment>
                )
            }
        }
        return label
    }

    @computed get barScale() {
        const maxValue = max(
            this.optionsWithMetricValue
                .map(option => option.plotValue)
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
            () => {
                this.focusOptionDirection(FocusDirection.first)
            }
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
            runInAction(() => {
                this.scrollFocusedIntoViewOnUpdate = false
            })
        }
    }

    @action updateMetric(columnSlug: string) {
        this.props.userState.countryPickerMetric = columnSlug
        this.props.userState.countryPickerSort =
            this.activePickerMetricColumn instanceof NumericColumn
                ? SortOrder.desc
                : SortOrder.asc
        Analytics.logCountrySelectorEvent(
            this.props.explorerSlug,
            "sortBy",
            columnSlug
        )
    }

    get pickerMenu() {
        return (
            !this.isDropdownMenu &&
            this.props.pickerColumnSlugs.size > 0 && (
                <div className="MetricSettings">
                    <span className="mainLabel">Sort by</span>
                    <Select
                        className="metricDropdown"
                        options={this.metricOptions}
                        value={this.metricOptions.find(
                            option => option.value === this.metric
                        )}
                        onChange={option => {
                            const value = first(asArray(option))?.value
                            if (value) this.updateMetric(value)
                        }}
                        menuPlacement="bottom"
                        components={{
                            IndicatorSeparator: null
                        }}
                        styles={getStylesForTargetHeight(26)}
                        isSearchable={false}
                    />
                    <span
                        className="sort"
                        onClick={() => {
                            const sortOrder = toggleSort(this.sortOrder)
                            this.props.userState.countryPickerSort = sortOrder
                            Analytics.logCountrySelectorEvent(
                                this.props.explorerSlug,
                                "sortOrder",
                                sortOrder
                            )
                        }}
                    >
                        <SortIcon
                            type={
                                this.metric === "location" ? "text" : "numeric"
                            }
                            order={this.sortOrder}
                        />
                    </span>
                </div>
            )
        )
    }

    render() {
        const countries = this.searchResults
        const selectedCountries = this.props.selectedEntities
        const availableCountries = this.availableCountriesForCurrentView

        const selectedDebugMessage = `${selectedCountries.length} selected. ${availableCountries.size} available. ${this.optionsWithMetricValue.length} options total.`

        return (
            <div className="CountryPicker" onKeyDown={this.onKeyDown}>
                <div className="CountryPickerSearchInput">
                    <input
                        className={classnames("input-field", {
                            "with-done-button": this.showDoneButton
                        })}
                        type="text"
                        placeholder="Type to add a country..."
                        value={this.searchInput ?? ""}
                        onChange={e =>
                            (this.searchInput = e.currentTarget.value)
                        }
                        onFocus={this.onSearchFocus}
                        onBlur={this.onSearchBlur}
                        ref={this.searchInputRef}
                        data-track-note={`${this.props.explorerSlug}-country-search-input`}
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
                                isDropdown: this.isDropdownMenu
                            })}
                            onMouseDown={this.onMenuMouseDown}
                        >
                            <VerticalScrollContainer
                                scrollingShadows={true}
                                scrollLock={true}
                                className="CountrySearchResults"
                                contentsId={countries
                                    .map(c => c.name)
                                    .join(",")}
                                onMouseMove={this.unblockHover}
                                ref={this.scrollContainerRef}
                            >
                                <Flipper
                                    spring={{
                                        stiffness: 300,
                                        damping: 33
                                    }}
                                    // We only want to animate when the selection changes, but not on changes due to
                                    // searching
                                    flipKey={selectedCountries.join(",")}
                                >
                                    {countries.map((option, index) => (
                                        <PickerOption
                                            key={index}
                                            hasDataForActiveMetric={availableCountries.has(
                                                option.name
                                            )}
                                            optionWithMetricValue={option}
                                            highlight={this.highlightLabel}
                                            barScale={this.barScale}
                                            color={
                                                this.props.optionColorMap[
                                                    option.name
                                                ]
                                            }
                                            onChange={this.selectCountryName}
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
                                    data-track-note={`${this.props.explorerSlug}-clear-selection`}
                                    onClick={this.props.clearSelectionCommand}
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
    optionWithMetricValue: CountryOptionWithMetricValue
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
            this.props.optionWithMetricValue.name,
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
            highlight
        } = this.props
        const { name, plotValue, formattedValue } = optionWithMetricValue
        let metricValue = formattedValue === name ? "" : formattedValue // If the user has "country name" selected, don't show the name twice.

        return (
            <Flipped flipId={name} translate opacity>
                <label
                    className={classnames(
                        "CountryOption",
                        {
                            selected: isSelected,
                            focused: isFocused
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
                            value={name}
                            tabIndex={-1}
                            readOnly
                        />
                    </div>
                    <div className="info-container">
                        <div className="labels-container">
                            <div className="name">{highlight(name)}</div>
                            {plotValue !== undefined && (
                                <div className="metric">{metricValue}</div>
                            )}
                        </div>
                        {barScale && isNumber(plotValue) ? (
                            <div className="plot">
                                <div
                                    className="bar"
                                    style={{
                                        width: `${barScale(plotValue) * 100}%`
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
