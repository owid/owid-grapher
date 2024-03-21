import React from "react"
import { observer } from "mobx-react"
import { computed, action, observable } from "mobx"
import classnames from "classnames"
import { isTouchDevice, sortBy, isCountryName } from "@ourworldindata/utils"
import { Checkbox } from "@ourworldindata/components"
import { FuzzySearch } from "../controls/FuzzySearch"
import { faMagnifyingGlass, faCheck } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { SelectionArray } from "../selection/SelectionArray"

export interface EntitySelectorManager {
    selection: SelectionArray
    canChangeEntity: boolean
    entitiesAreCountryLike?: boolean
}

interface SearchableEntity {
    name: string
}

interface SearchResultProps {
    result: SearchableEntity
    isMulti: boolean
    isChecked: boolean
    onSelect: (entityName: string) => void
}

class EntitySearchResult extends React.PureComponent<SearchResultProps> {
    render(): JSX.Element {
        const { result, isMulti, isChecked, onSelect } = this.props

        if (isMulti) {
            return (
                <li>
                    <Checkbox
                        label={result.name}
                        checked={isChecked}
                        onChange={(): void => onSelect(result.name)}
                    />
                </li>
            )
        } else {
            return (
                <li
                    className={"clickable" + (isChecked ? " selected" : "")}
                    onClick={(): void => onSelect(result.name)}
                >
                    {result.name}
                    {isChecked && <FontAwesomeIcon icon={faCheck} />}
                </li>
            )
        }
    }
}

@observer
export class EntitySelector extends React.Component<{
    manager: EntitySelectorManager
    onDismiss?: () => void
    autoFocus?: boolean
}> {
    @observable searchInput: string = ""
    searchField!: HTMLInputElement

    @computed private get manager(): EntitySelectorManager {
        return this.props.manager
    }

    @computed private get selectionArray(): SelectionArray {
        return this.manager.selection
    }

    @computed get sortedAvailableEntities(): string[] {
        return sortBy(this.selectionArray.availableEntityNames)
    }

    @computed get isMulti(): boolean {
        return !this.manager.canChangeEntity
    }

    @computed get fuzzy(): FuzzySearch<SearchableEntity> {
        return new FuzzySearch(this.searchableEntities, "name")
    }

    @computed private get searchableEntities(): SearchableEntity[] {
        return this.sortedAvailableEntities.map((name) => {
            return { name } as SearchableEntity
        })
    }

    @computed get searchResults(): SearchableEntity[] {
        return this.searchInput
            ? this.fuzzy.search(this.searchInput)
            : this.searchableEntities
    }

    @action.bound onSelect(entityName: string): void {
        if (this.isMulti) {
            this.selectionArray.toggleSelection(entityName)
        } else {
            this.selectionArray.setSelectedEntities([entityName])
            if (this.props.onDismiss) this.props.onDismiss()
        }
    }

    componentDidMount(): void {
        if (this.props.autoFocus && !isTouchDevice()) this.searchField.focus()
    }

    @action.bound onSearchKeyDown(e: React.KeyboardEvent<HTMLElement>): void {
        if (e.key === "Enter" && this.searchResults.length > 0) {
            this.onSelect(this.searchResults[0].name)
            this.searchInput = ""
        }
    }

    @action.bound onClear(): void {
        this.selectionArray.clearSelection()
    }

    renderSelectedData(): React.ReactNode {
        const selectedEntityNames = this.selectionArray.selectedEntityNames

        // only render something in isMulti mode
        if (this.isMulti) {
            return (
                <div className="selectedData">
                    {selectedEntityNames.length > 0 && (
                        <div className="selectedLabel">Selection</div>
                    )}
                    <ul>
                        {selectedEntityNames.map((name) => {
                            return (
                                <li key={name}>
                                    <Checkbox
                                        label={name}
                                        checked={true}
                                        onChange={(): void => {
                                            this.onSelect(name)
                                        }}
                                    />
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )
        } else return undefined
    }

    render(): JSX.Element {
        const { selectionArray, searchResults, searchInput } = this

        return (
            <div
                className={classnames(
                    "EntitySelector",
                    this.isMulti
                        ? "EntitySelectorMulti"
                        : "EntitySelectorSingle"
                )}
            >
                <div className="searchBar">
                    <div className="searchInput">
                        <input
                            type="search"
                            placeholder="Search..."
                            value={searchInput}
                            onChange={(e): void => {
                                this.searchInput = e.currentTarget.value
                            }}
                            onKeyDown={this.onSearchKeyDown}
                            ref={(e): HTMLInputElement =>
                                (this.searchField = e as HTMLInputElement)
                            }
                        />
                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                    </div>
                    {this.isMulti &&
                    selectionArray.selectedEntityNames.length > 0 ? (
                        <button
                            className="clearSelection"
                            onClick={this.onClear}
                        >
                            Clear selection
                        </button>
                    ) : undefined}
                </div>

                <div className="entities">
                    <div className="searchResults">
                        {searchResults.length > 0 ? (
                            <ul>
                                {searchResults.map((result) => (
                                    <EntitySearchResult
                                        key={result.name}
                                        result={result}
                                        isMulti={this.isMulti}
                                        isChecked={selectionArray.selectedSet.has(
                                            result.name
                                        )}
                                        onSelect={this.onSelect}
                                    />
                                ))}
                            </ul>
                        ) : (
                            <div className="empty">
                                {this.manager.entitiesAreCountryLike &&
                                isCountryName(this.searchInput)
                                    ? "There is no data for the country, region or group you are looking for."
                                    : "Nothing turned up. You may want to try using different keywords or checking for typos."}
                            </div>
                        )}
                    </div>
                    {this.renderSelectedData()}
                </div>
            </div>
        )
    }
}
