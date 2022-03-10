import React from "react"
import { observer } from "mobx-react"
import { computed, action, observable } from "mobx"
import { isTouchDevice, sortBy } from "../../clientUtils/Util.js"
import { FuzzySearch } from "./FuzzySearch.js"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { SelectionArray } from "../selection/SelectionArray.js"

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
class EntitySelectorBase extends React.Component<{
    selectionArray: SelectionArray
    isMulti: boolean
    onDismiss: () => void
}> {
    @observable searchInput?: string
    searchField!: HTMLInputElement
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @computed get availableEntities(): string[] {
        return this.props.selectionArray.availableEntityNames
    }

    @computed get isMulti(): boolean {
        return this.props.isMulti
    }

    @computed get fuzzy(): FuzzySearch<SearchableEntity> {
        return new FuzzySearch(this.searchableEntities, "name")
    }

    @computed private get searchableEntities(): SearchableEntity[] {
        return this.availableEntities.map((name) => {
            return { name } as SearchableEntity
        })
    }

    @computed get searchResults(): SearchableEntity[] {
        return this.searchInput
            ? this.fuzzy.search(this.searchInput)
            : sortBy(this.searchableEntities, (result) => result.name)
    }

    @action.bound onSelect(entityName: string): void {
        if (this.isMulti) {
            this.props.selectionArray.toggleSelection(entityName)
        } else {
            this.props.selectionArray.setSelectedEntities([entityName])
            this.props.onDismiss()
        }
    }

    @action.bound onDocumentClick(e: MouseEvent): void {
        // check if the click was outside of the modal
        if (
            this.base?.current &&
            !this.base.current.contains(e.target as Node) &&
            document.contains(e.target as Node)
        )
            this.props.onDismiss()
    }

    componentDidMount(): void {
        document.addEventListener("click", this.onDocumentClick)

        if (!isTouchDevice()) this.searchField.focus()
    }

    componentWillUnmount(): void {
        document.removeEventListener("click", this.onDocumentClick)
    }

    @action.bound onSearchKeyDown(
        e: React.KeyboardEvent<HTMLInputElement>
    ): void {
        if (e.key === "Enter" && this.searchResults.length > 0) {
            this.onSelect(this.searchResults[0].name)
            this.searchInput = ""
        } else if (e.key === "Escape") this.props.onDismiss()
    }

    @action.bound onClear(): void {
        this.props.selectionArray.clearSelection()
    }

    renderSelectedData() {
        const selectedEntityNames =
            this.props.selectionArray.selectedEntityNames

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
        const { selectionArray } = this.props
        const { searchResults, searchInput } = this

        return (
            <div className="entitySelectorOverlay">
                <div
                    ref={this.base}
                    className={
                        this.isMulti
                            ? "EntitySelectorMulti"
                            : "EntitySelectorSingle"
                    }
                >
                    <header className="wrapper">
                        <h2>
                            Choose data to show{" "}
                            <button onClick={this.props.onDismiss}>
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </h2>
                    </header>
                    <div className="entities wrapper">
                        <div className="searchResults">
                            <input
                                type="search"
                                placeholder="Search..."
                                value={searchInput}
                                onInput={(e): void => {
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
            </div>
        )
    }
}

@observer
export class EntitySelectorModal extends React.Component<{
    selectionArray: SelectionArray
    canChangeEntity?: boolean
    isMobile: boolean
    onDismiss: () => void
}> {
    render(): JSX.Element {
        return (
            <EntitySelectorBase
                isMulti={!this.props.canChangeEntity}
                {...this.props}
            />
        )
    }
}
