import * as React from "react"
import { observer } from "mobx-react"
import { computed, action, observable } from "mobx"

import { uniqBy, isTouchDevice, sortBy } from "../utils/Util"
import { ChartRuntime } from "charts/core/ChartRuntime"
import { FuzzySearch } from "./FuzzySearch"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { EntityDimensionKey } from "charts/core/ChartConstants"
import { EntityDimensionInfo } from "charts/core/ChartDimension"

@observer
class EntitySelectorMulti extends React.Component<{
    chart: ChartRuntime
    onDismiss: () => void
}> {
    @observable searchInput?: string
    searchField!: HTMLInputElement
    base: React.RefObject<HTMLDivElement> = React.createRef()
    dismissable: boolean = true

    @computed get availableEntities(): EntityDimensionInfo[] {
        return this.props.chart.selectableEntityDimensionKeys
    }

    @computed get selectedEntities() {
        return this.availableEntities.filter(d =>
            this.isSelectedKey(d.entityDimensionKey)
        )
    }

    @computed get fuzzy(): FuzzySearch<EntityDimensionInfo> {
        return new FuzzySearch(this.availableEntities, "label")
    }

    @computed get searchResults(): EntityDimensionInfo[] {
        return this.searchInput
            ? this.fuzzy.search(this.searchInput)
            : sortBy(this.availableEntities, result => result.label)
    }

    isSelectedKey(entityDimensionKey: EntityDimensionKey): boolean {
        return !!this.props.chart.selectedKeysByKey[entityDimensionKey]
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
            this.props.chart.toggleKey(this.searchResults[0].entityDimensionKey)
            this.searchInput = ""
        } else if (e.key === "Escape") this.props.onDismiss()
    }

    @action.bound onClear() {
        this.props.chart.selectedKeys = []
    }

    render() {
        const { chart } = this.props
        const {
            selectedEntities: selectedData,
            searchResults,
            searchInput
        } = this

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
                                onInput={e =>
                                    (this.searchInput = e.currentTarget.value)
                                }
                                onKeyDown={this.onSearchKeyDown}
                                ref={e =>
                                    (this.searchField = e as HTMLInputElement)
                                }
                            />
                            <ul>
                                {searchResults.map(d => {
                                    return (
                                        <li key={d.entityDimensionKey}>
                                            <label className="clickable">
                                                <input
                                                    type="checkbox"
                                                    checked={this.isSelectedKey(
                                                        d.entityDimensionKey
                                                    )}
                                                    onChange={() =>
                                                        chart.toggleKey(
                                                            d.entityDimensionKey
                                                        )
                                                    }
                                                />{" "}
                                                {d.label}
                                            </label>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                        <div className="selectedData">
                            <ul>
                                {selectedData.map(d => {
                                    return (
                                        <li key={d.entityDimensionKey}>
                                            <label className="clickable">
                                                <input
                                                    type="checkbox"
                                                    checked={this.isSelectedKey(
                                                        d.entityDimensionKey
                                                    )}
                                                    onChange={() =>
                                                        chart.toggleKey(
                                                            d.entityDimensionKey
                                                        )
                                                    }
                                                />{" "}
                                                {d.label}
                                            </label>
                                        </li>
                                    )
                                })}
                            </ul>
                            {selectedData && selectedData.length > 1 ? (
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
    chart: ChartRuntime
    isMobile: boolean
    onDismiss: () => void
}> {
    @observable searchInput?: string
    searchField!: HTMLInputElement
    base: React.RefObject<HTMLDivElement> = React.createRef()
    dismissable: boolean = true

    @computed private get availableEntities() {
        const availableItems: { id: number; label: string }[] = []
        this.props.chart.entityDimensionMap.forEach(meta => {
            availableItems.push({
                id: meta.entityId,
                label: meta.entityName
            })
        })
        return uniqBy(availableItems, d => d.label)
    }

    @computed get fuzzy(): FuzzySearch<{ id: number; label: string }> {
        return new FuzzySearch(this.availableEntities, "label")
    }

    @computed get searchResults(): { id: number; label: string }[] {
        return this.searchInput
            ? this.fuzzy.search(this.searchInput)
            : sortBy(this.availableEntities, result => result.label)
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
            this.onSelect(this.searchResults[0].id)
            this.searchInput = ""
        } else if (e.key === "Escape") this.props.onDismiss()
    }

    @action.bound onSelect(entityId: number) {
        this.props.chart.setSingleSelectedEntity(entityId)
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
                            onInput={e =>
                                (this.searchInput = e.currentTarget.value)
                            }
                            onKeyDown={this.onSearchKeyDown}
                            ref={e =>
                                (this.searchField = e as HTMLInputElement)
                            }
                        />
                        <ul>
                            {searchResults.map(d => {
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
    chart: ChartRuntime
    isMobile: boolean
    onDismiss: () => void
}> {
    render() {
        return this.props.chart.canChangeEntity ? (
            <EntitySelectorSingle {...this.props} />
        ) : (
            <EntitySelectorMulti {...this.props} />
        )
    }
}
