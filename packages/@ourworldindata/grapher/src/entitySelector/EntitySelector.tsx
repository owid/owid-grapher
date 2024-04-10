import React from "react"
import { observer } from "mobx-react"
import { computed, action, reaction } from "mobx"
import cx from "classnames"
import a from "indefinite"
import {
    isTouchDevice,
    sortBy,
    partition,
    capitalize,
} from "@ourworldindata/utils"
import { Checkbox } from "@ourworldindata/components"
import { FuzzySearch } from "../controls/FuzzySearch"
import {
    faCircleXmark,
    faMagnifyingGlass,
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
} from "../core/GrapherConstants"

export interface EntitySelectorState {
    searchInput: string
    mostRecentlySelectedEntityName?: string
}

export interface EntitySelectorManager {
    entitySelectorState: Partial<EntitySelectorState>
    selection: SelectionArray
    canChangeEntity: boolean
    entityType?: string
    entityTypePlural?: string
}

interface SearchableEntity {
    name: string
}

interface PartitionedEntities {
    selected: string[]
    unselected: string[]
}

@observer
export class EntitySelector extends React.Component<{
    manager: EntitySelectorManager
    onDismiss?: () => void
    autoFocus?: boolean
}> {
    container: React.RefObject<HTMLDivElement> = React.createRef()
    searchField: React.RefObject<HTMLInputElement> = React.createRef()

    componentDidMount(): void {
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

    private set(state: Partial<EntitySelectorState>): void {
        this.manager.entitySelectorState = {
            ...this.manager.entitySelectorState,
            ...state,
        }
    }

    private clearSearchInput(): void {
        this.set({ searchInput: "" })
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

    @computed get sortedAvailableEntities(): string[] {
        return sortBy(this.selectionArray.availableEntityNames)
    }

    @computed private get searchableEntities(): SearchableEntity[] {
        return this.sortedAvailableEntities.map((name) => ({ name }))
    }

    @computed get isMultiMode(): boolean {
        return !this.manager.canChangeEntity
    }

    @computed get fuzzy(): FuzzySearch<SearchableEntity> {
        return new FuzzySearch(this.searchableEntities, "name")
    }

    @computed get searchResults(): SearchableEntity[] | undefined {
        return this.searchInput
            ? this.fuzzy.search(this.searchInput)
            : undefined
    }

    @computed get partitionedSearchResults(): PartitionedEntities | undefined {
        const { searchResults } = this

        if (!searchResults) return undefined

        const [selected, unselected] = partition(
            searchResults.map((entity) => entity.name),
            (name) => this.isEntitySelected(name)
        )

        return { selected, unselected }
    }

    @computed get partitionedAvailableEntities(): PartitionedEntities {
        const [selected, unselected] = partition(
            this.sortedAvailableEntities,
            (name) => this.isEntitySelected(name)
        )

        return { selected, unselected }
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
        const { partitionedSearchResults: searchResults } = this
        if (this.searchInput) {
            this.selectionArray.deselectEntities(searchResults?.selected ?? [])
        } else {
            this.selectionArray.clearSelection()
        }
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
                {this.searchResults.map(({ name }) => (
                    <li key={name}>
                        <SelectableEntity
                            name={name}
                            type={this.isMultiMode ? "checkbox" : "radio"}
                            checked={this.isEntitySelected(name)}
                            onChange={() => this.onChange(name)}
                        />
                    </li>
                ))}
            </ul>
        )
    }

    private renderAllEntitiesInSingleMode(): JSX.Element {
        return (
            <ul>
                {this.sortedAvailableEntities.map((name) => (
                    <li key={name}>
                        <SelectableEntity
                            name={name}
                            type="radio"
                            checked={this.isEntitySelected(name)}
                            onChange={() => this.onChange(name)}
                        />
                    </li>
                ))}
            </ul>
        )
    }

    private isEntitySelected(name: string): boolean {
        return this.selectionArray.selectedSet.has(name)
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
                {selected.length > 0 && (
                    <Flipped flipId="__selection" translate opacity>
                        <div className="section-title grapher_body-3-medium-italic">
                            Selection
                        </div>
                    </Flipped>
                )}
                <ul>
                    {selected.map((name) => (
                        <Flipped key={name} flipId={name} translate opacity>
                            <li
                                className={cx("animated-entity", {
                                    "most-recently-selected":
                                        this.mostRecentlySelectedEntityName ===
                                        name,
                                })}
                            >
                                <SelectableEntity
                                    name={name}
                                    type="checkbox"
                                    checked={true}
                                    onChange={() => this.onChange(name)}
                                />
                            </li>
                        </Flipped>
                    ))}
                </ul>

                {selected.length > 0 && unselected.length > 0 && (
                    <Flipped flipId="__available" translate opacity>
                        <div className="section-title grapher_body-3-medium-italic grapher_light">
                            {capitalize(this.entityTypePlural)}
                        </div>
                    </Flipped>
                )}

                <ul>
                    {unselected.map((name) => (
                        <Flipped key={name} flipId={name} translate opacity>
                            <li
                                className={cx("animated-entity", {
                                    "most-recently-selected":
                                        this.mostRecentlySelectedEntityName ===
                                        name,
                                })}
                            >
                                <SelectableEntity
                                    name={name}
                                    type="checkbox"
                                    checked={false}
                                    onChange={() => this.onChange(name)}
                                />
                            </li>
                        </Flipped>
                    ))}
                </ul>
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

function SelectableEntity({
    name,
    checked,
    type,
    onChange,
}: {
    name: React.ReactNode
    checked: boolean
    type: "checkbox" | "radio"
    onChange: () => void
}) {
    const Input = {
        checkbox: Checkbox,
        radio: RadioButton,
    }[type]

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
            <Input label={name} checked={checked} onChange={onChange} />
        </div>
    )
}
