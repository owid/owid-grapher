import * as React from "react"
import { observer } from "mobx-react"
import { computed, action, observable } from "mobx"
import { uniqBy, isTouchDevice, sortBy } from "../../clientUtils/Util"
import { FuzzySearch } from "./FuzzySearch"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { SelectionArray } from "../selection/SelectionArray"

interface SearchableEntity {
    name: string
}

@observer
class EntitySelectorMulti extends React.Component<{
    selectionArray: SelectionArray
    onDismiss: () => void
}> {
    @observable searchInput?: string
    searchField!: HTMLInputElement
    base: React.RefObject<HTMLDivElement> = React.createRef()
    dismissable: boolean = true

    @computed get availableEntities(): string[] {
        return this.props.selectionArray.availableEntityNames
    }

    @computed get fuzzy(): FuzzySearch<SearchableEntity> {
        return new FuzzySearch(this.searchableEntities, "name")
    }

    @computed private get searchableEntities(): SearchableEntity[] {
        return this.availableEntities.map(
            (name): SearchableEntity => {
                return { name } as SearchableEntity
            }
        )
    }

    @computed get searchResults(): SearchableEntity[] {
        return this.searchInput
            ? this.fuzzy.search(this.searchInput)
            : sortBy(this.searchableEntities, (result): any => result.name)
    }

    @action.bound onClickOutside(e: MouseEvent): void {
        if (this.dismissable) this.props.onDismiss()
    }

    componentDidMount(): void {
        // HACK (Mispy): The normal ways of doing this (stopPropagation etc) don't seem to work here
        this.base.current!.addEventListener("click", (): void => {
            this.dismissable = false
            setTimeout((): boolean => (this.dismissable = true), 100)
        })
        setTimeout(
            (): void => document.addEventListener("click", this.onClickOutside),
            1
        )
        if (!isTouchDevice()) this.searchField.focus()
    }

    componentWillUnmount(): void {
        document.removeEventListener("click", this.onClickOutside)
    }

    @action.bound onSearchKeyDown(
        e: React.KeyboardEvent<HTMLInputElement>
    ): void {
        if (e.key === "Enter" && this.searchResults.length > 0) {
            this.props.selectionArray.selectEntity(this.searchResults[0].name)
            this.searchInput = ""
        } else if (e.key === "Escape") this.props.onDismiss()
    }

    @action.bound onClear(): void {
        this.props.selectionArray.clearSelection()
    }

    render(): JSX.Element {
        const { selectionArray } = this.props
        const { searchResults, searchInput } = this

        const selectedEntityNames = selectionArray.selectedEntityNames

        return (
            <div className="entitySelectorOverlay">
                <div ref={this.base} className="EntitySelectorMulti">
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
                                onInput={(e): string =>
                                    (this.searchInput = e.currentTarget.value)
                                }
                                onKeyDown={this.onSearchKeyDown}
                                ref={(e): HTMLInputElement =>
                                    (this.searchField = e as HTMLInputElement)
                                }
                            />
                            <ul>
                                {searchResults.map(
                                    (result): JSX.Element => {
                                        return (
                                            <li key={result.name}>
                                                <label className="clickable">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectionArray.selectedSet.has(
                                                            result.name
                                                        )}
                                                        onChange={(): SelectionArray =>
                                                            selectionArray.toggleSelection(
                                                                result.name
                                                            )
                                                        }
                                                    />{" "}
                                                    {result.name}
                                                </label>
                                            </li>
                                        )
                                    }
                                )}
                            </ul>
                        </div>
                        <div className="selectedData">
                            <ul>
                                {selectedEntityNames.map(
                                    (name): JSX.Element => {
                                        return (
                                            <li key={name}>
                                                <label className="clickable">
                                                    <input
                                                        type="checkbox"
                                                        checked={true}
                                                        onChange={(): SelectionArray =>
                                                            selectionArray.deselectEntity(
                                                                name
                                                            )
                                                        }
                                                    />{" "}
                                                    {name}
                                                </label>
                                            </li>
                                        )
                                    }
                                )}
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
                    </div>
                </div>
            </div>
        )
    }
}

@observer
class EntitySelectorSingle extends React.Component<{
    selectionArray: SelectionArray
    isMobile: boolean
    onDismiss: () => void
}> {
    @observable searchInput?: string
    searchField!: HTMLInputElement
    base: React.RefObject<HTMLDivElement> = React.createRef()
    dismissable: boolean = true

    @computed private get availableEntities(): { id: string; label: string }[] {
        const availableItems: { id: string; label: string }[] = []
        this.props.selectionArray.availableEntityNames.forEach((name): void => {
            availableItems.push({
                id: name,
                label: name,
            })
        })
        return uniqBy(availableItems, (d): any => d.label)
    }

    @computed get fuzzy(): FuzzySearch<{ id: string; label: string }> {
        return new FuzzySearch(this.availableEntities, "label")
    }

    @computed get searchResults(): { id: string; label: string }[] {
        return this.searchInput
            ? this.fuzzy.search(this.searchInput)
            : sortBy(this.availableEntities, (result): any => result.label)
    }

    @action.bound onClickOutside(e: MouseEvent): void {
        if (this.base && !this.base.current!.contains(e.target as Node))
            this.props.onDismiss()
    }

    componentDidMount(): void {
        // HACK (Mispy): The normal ways of doing this (stopPropagation etc) don't seem to work here
        this.base.current!.addEventListener("click", (): void => {
            this.dismissable = false
            setTimeout((): boolean => (this.dismissable = true), 100)
        })
        setTimeout(
            (): void => document.addEventListener("click", this.onClickOutside),
            1
        )
        if (!this.props.isMobile) this.searchField.focus()
    }

    componentWillUnmount(): void {
        document.removeEventListener("click", this.onClickOutside)
    }

    @action.bound onSearchKeyDown(
        e: React.KeyboardEvent<HTMLInputElement>
    ): void {
        if (e.key === "Enter" && this.searchResults.length > 0) {
            this.onSelect(this.searchResults[0].label)
            this.searchInput = ""
        } else if (e.key === "Escape") this.props.onDismiss()
    }

    @action.bound onSelect(entityName: string): void {
        this.props.selectionArray.setSelectedEntities([entityName])
        this.props.onDismiss()
    }

    render(): JSX.Element {
        const { searchResults, searchInput } = this

        return (
            <div className="entitySelectorOverlay">
                <div ref={this.base} className="EntitySelectorSingle">
                    <header className="wrapper">
                        <h2>
                            Choose data to show{" "}
                            <button onClick={this.props.onDismiss}>
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </h2>
                    </header>
                    <div className="wrapper">
                        <input
                            type="search"
                            placeholder="Search..."
                            value={searchInput}
                            onInput={(e): string =>
                                (this.searchInput = e.currentTarget.value)
                            }
                            onKeyDown={this.onSearchKeyDown}
                            ref={(e): HTMLInputElement =>
                                (this.searchField = e as HTMLInputElement)
                            }
                        />
                        <ul>
                            {searchResults.map(
                                (d): JSX.Element => {
                                    return (
                                        <li
                                            key={d.id}
                                            className="clickable"
                                            onClick={(): void =>
                                                this.onSelect(d.id)
                                            }
                                        >
                                            {d.label}
                                        </li>
                                    )
                                }
                            )}
                        </ul>
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
        return this.props.canChangeEntity ? (
            <EntitySelectorSingle {...this.props} />
        ) : (
            <EntitySelectorMulti {...this.props} />
        )
    }
}
