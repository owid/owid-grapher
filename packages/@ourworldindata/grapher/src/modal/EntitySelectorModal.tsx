import React from "react"
import { observer } from "mobx-react"
import { computed, action, observable } from "mobx"
import { isTouchDevice, sortBy } from "@ourworldindata/utils"
import { FuzzySearch } from "../controls/FuzzySearch"
import { faTimes } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { SelectionArray } from "../selection/SelectionArray"
import { Modal, ModalContext } from "./Modal"

export interface EntitySelectorModalManager {
    selection: SelectionArray
    canChangeEntity: boolean
    isSelectingData?: boolean
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
                    <label className="clickable">
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(): void => onSelect(result.name)}
                        />{" "}
                        {result.name}
                    </label>
                </li>
            )
        } else {
            return (
                <li
                    className="clickable"
                    onClick={(): void => onSelect(result.name)}
                >
                    {result.name}
                </li>
            )
        }
    }
}

@observer
export class EntitySelectorModal extends React.Component<{
    manager: EntitySelectorModalManager
}> {
    static contextType = ModalContext

    @observable searchInput: string = ""
    searchField!: HTMLInputElement

    @computed private get manager(): EntitySelectorModalManager {
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
            this.context.onDismiss()
        }
    }

    componentDidMount(): void {
        if (!isTouchDevice()) this.searchField.focus()
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
                    <ul>
                        {selectedEntityNames.map((name) => {
                            return (
                                <li key={name}>
                                    <label className="clickable">
                                        <input
                                            type="checkbox"
                                            checked={true}
                                            onChange={(): void => {
                                                this.onSelect(name)
                                            }}
                                        />{" "}
                                        {name}
                                    </label>
                                </li>
                            )
                        })}
                    </ul>
                    {selectedEntityNames.length > 1 ? (
                        <button
                            className="clearSelection"
                            onClick={this.onClear}
                        >
                            <span className="icon">
                                <FontAwesomeIcon icon={faTimes} />
                            </span>{" "}
                            Unselect all
                        </button>
                    ) : undefined}
                </div>
            )
        } else return undefined
    }

    render(): JSX.Element {
        const { selectionArray, searchResults, searchInput } = this

        return (
            <Modal
                onDismiss={action(() => (this.manager.isSelectingData = false))}
            >
                <div
                    className={
                        this.isMulti
                            ? "EntitySelectorMulti"
                            : "EntitySelectorSingle"
                    }
                >
                    <header className="wrapper">
                        <h2>Choose data to show</h2>
                    </header>
                    <div className="entities wrapper">
                        <div className="searchResults">
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
                        </div>
                        {this.renderSelectedData()}
                    </div>
                </div>
            </Modal>
        )
    }
}
