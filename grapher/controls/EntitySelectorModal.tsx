import * as React from "react"
import { observer } from "mobx-react"
import { computed, action, observable } from "mobx"

import { uniqBy, isTouchDevice, sortBy } from "grapher/utils/Util"
import { Grapher } from "grapher/core/Grapher"
import { FuzzySearch } from "./FuzzySearch"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

interface SearchableEntity {
    name: string
}

@observer
class EntitySelectorMulti extends React.Component<{
    grapher: Grapher
    onDismiss: () => void
}> {
    @observable searchInput?: string
    searchField!: HTMLInputElement
    base: React.RefObject<HTMLDivElement> = React.createRef()
    dismissable: boolean = true

    @computed get availableEntities() {
        return this.props.grapher.table.availableEntityNames
    }

    @computed get fuzzy(): FuzzySearch<SearchableEntity> {
        return new FuzzySearch(this.searchableEntities, "name")
    }

    @computed private get searchableEntities() {
        return this.availableEntities.map((name) => {
            return { name } as SearchableEntity
        })
    }

    @computed get searchResults() {
        return this.searchInput
            ? this.fuzzy.search(this.searchInput)
            : this.searchableEntities
    }

    @action.bound onClickOutside(e: MouseEvent) {
        if (this.dismissable) this.props.onDismiss()
    }

    componentDidMount() {
        // HACK (Mispy): The normal ways of doing this (stopPropagation etc) don't seem to work here
        this.base.current!.addEventListener("click", () => {
            this.dismissable = false
            setTimeout(() => (this.dismissable = true), 100)
        })
        setTimeout(
            () => document.addEventListener("click", this.onClickOutside),
            1
        )
        if (!isTouchDevice()) this.searchField.focus()
    }

    componentWillUnmount() {
        document.removeEventListener("click", this.onClickOutside)
    }

    @action.bound onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && this.searchResults.length > 0) {
            this.props.grapher.table.selectEntity(this.searchResults[0].name)
            this.searchInput = ""
        } else if (e.key === "Escape") this.props.onDismiss()
    }

    @action.bound onClear() {
        this.props.grapher.table.clearSelection()
    }

    render() {
        const { grapher } = this.props
        const { searchResults, searchInput } = this

        const table = grapher.table
        const selectedEntityNames = table.selectedEntityNames

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
                                onInput={(e) =>
                                    (this.searchInput = e.currentTarget.value)
                                }
                                onKeyDown={this.onSearchKeyDown}
                                ref={(e) =>
                                    (this.searchField = e as HTMLInputElement)
                                }
                            />
                            <ul>
                                {searchResults.map((result) => {
                                    return (
                                        <li key={result.name}>
                                            <label className="clickable">
                                                <input
                                                    type="checkbox"
                                                    checked={table.isEntitySelected(
                                                        result.name
                                                    )}
                                                    onChange={() =>
                                                        table.toggleSelection(
                                                            result.name
                                                        )
                                                    }
                                                />{" "}
                                                {result.name}
                                            </label>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                        <div className="selectedData">
                            <ul>
                                {selectedEntityNames.map((name) => {
                                    return (
                                        <li key={name}>
                                            <label className="clickable">
                                                <input
                                                    type="checkbox"
                                                    checked={true}
                                                    onChange={() =>
                                                        table.deselectEntity(
                                                            name
                                                        )
                                                    }
                                                />{" "}
                                                {name.label}
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
                    </div>
                </div>
            </div>
        )
    }
}

@observer
class EntitySelectorSingle extends React.Component<{
    grapher: Grapher
    isMobile: boolean
    onDismiss: () => void
}> {
    @observable searchInput?: string
    searchField!: HTMLInputElement
    base: React.RefObject<HTMLDivElement> = React.createRef()
    dismissable: boolean = true

    @computed private get availableEntities() {
        const availableItems: { id: string; label: string }[] = []
        this.props.grapher.table.availableEntityNames.forEach((name) => {
            availableItems.push({
                id: name,
                label: name,
            })
        })
        return uniqBy(availableItems, (d) => d.label)
    }

    @computed get fuzzy(): FuzzySearch<{ id: string; label: string }> {
        return new FuzzySearch(this.availableEntities, "label")
    }

    @computed get searchResults(): { id: string; label: string }[] {
        return this.searchInput
            ? this.fuzzy.search(this.searchInput)
            : sortBy(this.availableEntities, (result) => result.label)
    }

    @action.bound onClickOutside(e: MouseEvent) {
        if (this.base && !this.base.current!.contains(e.target as Node))
            this.props.onDismiss()
    }

    componentDidMount() {
        // HACK (Mispy): The normal ways of doing this (stopPropagation etc) don't seem to work here
        this.base.current!.addEventListener("click", () => {
            this.dismissable = false
            setTimeout(() => (this.dismissable = true), 100)
        })
        setTimeout(
            () => document.addEventListener("click", this.onClickOutside),
            1
        )
        if (!this.props.isMobile) this.searchField.focus()
    }

    componentWillUnmount() {
        document.removeEventListener("click", this.onClickOutside)
    }

    @action.bound onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" && this.searchResults.length > 0) {
            this.onSelect(this.searchResults[0].label)
            this.searchInput = ""
        } else if (e.key === "Escape") this.props.onDismiss()
    }

    @action.bound onSelect(entityName: string) {
        this.props.grapher.table.setSelectedEntities([entityName])
        this.props.onDismiss()
    }

    render() {
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
                            onInput={(e) =>
                                (this.searchInput = e.currentTarget.value)
                            }
                            onKeyDown={this.onSearchKeyDown}
                            ref={(e) =>
                                (this.searchField = e as HTMLInputElement)
                            }
                        />
                        <ul>
                            {searchResults.map((d) => {
                                return (
                                    <li
                                        key={d.id}
                                        className="clickable"
                                        onClick={() => this.onSelect(d.id)}
                                    >
                                        {d.label}
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                </div>
            </div>
        )
    }
}

@observer
export class EntitySelectorModal extends React.Component<{
    grapher: Grapher
    isMobile: boolean
    onDismiss: () => void
}> {
    render() {
        return this.props.grapher.canChangeEntity ? (
            <EntitySelectorSingle {...this.props} />
        ) : (
            <EntitySelectorMulti {...this.props} />
        )
    }
}
