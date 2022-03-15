import React from "react"
import * as lodash from "lodash-es"
import { groupBy, isString, sortBy } from "../clientUtils/Util.js"
import {
    computed,
    action,
    observable,
    autorun,
    runInAction,
    IReactionDisposer,
} from "mobx"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
    SearchWord,
} from "../clientUtils/search.js"
import { observer } from "mobx-react"
import { ReactSelect as Select } from "../clientUtils/import-shims.js"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArchive } from "@fortawesome/free-solid-svg-icons/faArchive.js"

import { ChartEditor, Dataset, Namespace } from "./ChartEditor.js"
import { TextField, FieldsRow, Toggle, Modal } from "./Forms.js"
import { OwidVariableId } from "../clientUtils/owidTypes.js"
import { DimensionSlot } from "../grapher/chart/DimensionSlot.js"

interface VariableSelectorProps {
    editor: ChartEditor
    slot: DimensionSlot
    onDismiss: () => void
    onComplete: (variableIds: OwidVariableId[]) => void
}

interface Variable {
    id: number
    name: string
    datasetName: string
    usageCount: number
}

@observer
export class VariableSelector extends React.Component<VariableSelectorProps> {
    @observable.ref chosenNamespace: Namespace | undefined
    @observable.ref searchInput?: string
    @observable.ref isProjection?: boolean
    @observable.ref tolerance?: number
    @observable.ref chosenVariables: Variable[] = []
    searchField!: HTMLInputElement
    scrollElement!: HTMLDivElement

    @observable rowOffset: number = 0
    @observable numVisibleRows: number = 15
    @observable rowHeight: number = 32

    @computed get database() {
        return this.props.editor.database
    }

    @computed get currentNamespace() {
        return (
            this.chosenNamespace ??
            this.database.namespaces.find((n) => n.name === "owid")!
        )
    }

    @computed get searchWords(): SearchWord[] {
        const { searchInput } = this
        return buildSearchWordsFromSearchString(searchInput)
    }

    @computed get editorData() {
        return this.database.dataByNamespace.get(this.currentNamespace.name)
    }

    @computed get datasets() {
        if (!this.editorData) return []

        const datasets = this.editorData.datasets

        if (this.currentNamespace.name !== "owid") {
            // The default temporal ordering has no real use for bulk imports
            return sortBy(datasets, (d) => d.name)
        } else {
            return datasets
        }
    }

    @computed get datasetsByName(): Record<string, Dataset> {
        return lodash.keyBy(this.datasets, (d) => d.name)
    }

    @computed get availableVariables(): Variable[] {
        const { variableUsageCounts } = this.database
        const variables: Variable[] = []
        this.datasets.forEach((dataset) => {
            const sorted = sortBy(dataset.variables, [
                (v) => (variableUsageCounts.get(v.id) ?? 0) * -1,
                (v) => v.name,
            ])
            sorted.forEach((variable) => {
                variables.push({
                    id: variable.id,
                    name: variable.name,
                    datasetName: dataset.name,
                    usageCount: variableUsageCounts.get(variable.id) ?? 0,
                    //name: variable.name.includes(dataset.name) ? variable.name : dataset.name + " - " + variable.name
                })
            })
        })
        return variables
    }

    @computed get searchResults(): Variable[] {
        let results: Variable[] | undefined
        const { searchWords } = this
        if (searchWords.length > 0) {
            const filterFn = filterFunctionForSearchWords(
                searchWords,
                (variable: Variable) => [variable.name, variable.datasetName]
            )
            results = this.availableVariables.filter(filterFn)
        }
        return results && results.length
            ? results // results.map((result) => result.obj)
            : []
    }

    @computed get resultsByDataset(): { [datasetName: string]: Variable[] } {
        const { searchResults, searchWords, availableVariables } = this
        let datasetListToUse = searchResults
        if (searchWords.length == 0) {
            datasetListToUse = availableVariables
        }
        return groupBy(datasetListToUse, (d) => d.datasetName)
    }

    @computed get searchResultRows() {
        const { resultsByDataset } = this

        const rows: Array<string | Variable[]> = []
        const unsorted = Object.entries(resultsByDataset)
        const sorted = lodash.sortBy(unsorted, ([datasetName, variables]) => {
            const sizes = lodash.map(
                variables,
                (variable) => variable.usageCount ?? 0
            )
            return Math.max(...sizes) * -1
        })
        sorted.forEach(([datasetName, variables]) => {
            rows.push(datasetName)

            for (let i = 0; i < variables.length; i += 2) {
                rows.push(variables.slice(i, i + 2))
            }
        })
        return rows
    }

    @computed get numTotalRows(): number {
        return this.searchResultRows.length
    }

    formatNamespaceLabel(namespace: Namespace) {
        const { name, description, isArchived } = namespace
        return (
            <span className={isArchived ? "muted-option" : ""}>
                {isArchived && (
                    <span className="icon">
                        <FontAwesomeIcon icon={faArchive} />
                    </span>
                )}
                {description ? `${description} — ` : null}
                {name}
                {isArchived && <span className="badge">Archived</span>}
            </span>
        )
    }

    filterNamespace(option: any, input: string) {
        return input
            .split(" ")
            .map((word) => word.toLowerCase())
            .map((word) => {
                const namespace = option.data as Namespace
                return (
                    namespace.name.toLowerCase().includes(word) ||
                    namespace.description?.toLowerCase().includes(word)
                )
            })
            .every((v) => v)
    }

    render() {
        const { slot } = this.props
        const { database } = this.props.editor
        const {
            currentNamespace,
            searchInput,
            chosenVariables,
            datasetsByName,
            rowHeight,
            rowOffset,
            numVisibleRows,
            numTotalRows,
            searchResultRows,
            searchWords,
        } = this

        const highlight = highlightFunctionForSearchWords(searchWords)

        return (
            <Modal onClose={this.onDismiss} className="VariableSelector">
                <div className="modal-header">
                    <h5 className="modal-title">
                        Set variable{slot.allowMultiple && "s"} for {slot.name}
                    </h5>
                </div>
                <div className="modal-body">
                    <div>
                        <div className="searchResults">
                            <FieldsRow>
                                <div className="form-group">
                                    <label>Database</label>
                                    <Select
                                        options={database.namespaces}
                                        formatOptionLabel={
                                            this.formatNamespaceLabel
                                        }
                                        getOptionValue={(v) => v.name}
                                        onChange={this.onNamespace}
                                        value={currentNamespace}
                                        filterOption={this.filterNamespace}
                                        components={{
                                            IndicatorSeparator: null,
                                        }}
                                        menuPlacement="bottom"
                                    />
                                </div>
                                <TextField
                                    placeholder="Search..."
                                    value={searchInput}
                                    onValue={this.onSearchInput}
                                    onEnter={this.onSearchEnter}
                                    onEscape={this.onDismiss}
                                    autofocus
                                />
                            </FieldsRow>
                            <div
                                style={{
                                    height: numVisibleRows * rowHeight,
                                    overflowY: "scroll",
                                }}
                                onScroll={this.onScroll}
                                ref={(e) =>
                                    (this.scrollElement = e as HTMLDivElement)
                                }
                            >
                                <div
                                    style={{
                                        height: numTotalRows * rowHeight,
                                        paddingTop: rowHeight * rowOffset,
                                    }}
                                >
                                    <ul>
                                        {searchResultRows
                                            .slice(
                                                rowOffset,
                                                rowOffset + numVisibleRows
                                            )
                                            .map((d) => {
                                                if (isString(d)) {
                                                    const dataset =
                                                        datasetsByName[d]
                                                    return (
                                                        <li
                                                            key={dataset.name}
                                                            style={{
                                                                minWidth:
                                                                    "100%",
                                                            }}
                                                        >
                                                            <h5>
                                                                {highlight(
                                                                    dataset.name
                                                                )}
                                                                {dataset.nonRedistributable ? (
                                                                    <span className="text-danger">
                                                                        {" "}
                                                                        (non-redistributable)
                                                                    </span>
                                                                ) : dataset.isPrivate ? (
                                                                    <span className="text-danger">
                                                                        {" "}
                                                                        (unpublished)
                                                                    </span>
                                                                ) : (
                                                                    ""
                                                                )}
                                                            </h5>
                                                        </li>
                                                    )
                                                } else {
                                                    return d.map((v) => (
                                                        <li
                                                            key={`${v.id}-${v.name}`}
                                                            style={{
                                                                minWidth: "50%",
                                                            }}
                                                        >
                                                            <Toggle
                                                                value={this.chosenVariables
                                                                    .map(
                                                                        (cv) =>
                                                                            cv.id
                                                                    )
                                                                    .includes(
                                                                        v.id
                                                                    )}
                                                                onValue={() =>
                                                                    this.toggleVariable(
                                                                        v
                                                                    )
                                                                }
                                                                label={
                                                                    <React.Fragment>
                                                                        {highlight(
                                                                            v.name
                                                                        )}

                                                                        <span
                                                                            style={{
                                                                                fontWeight: 500,
                                                                                color: "#555",
                                                                            }}
                                                                        >
                                                                            {v.usageCount
                                                                                ? ` (used ${v.usageCount} times)`
                                                                                : " (unused)"}
                                                                        </span>
                                                                    </React.Fragment>
                                                                }
                                                            />
                                                        </li>
                                                    ))
                                                }
                                            })}
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="selectedData">
                            <ul>
                                {chosenVariables.map((d) => {
                                    return (
                                        <li key={d.id}>
                                            <Toggle
                                                value={true}
                                                onValue={() =>
                                                    this.unselectVariable(d)
                                                }
                                                label={d.name}
                                            />
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn" onClick={this.onDismiss}>
                        Close
                    </button>
                    <button
                        className="btn btn-success"
                        onClick={this.onComplete}
                    >
                        Set variable{slot.allowMultiple && "s"}
                    </button>
                </div>
            </Modal>
        )
    }

    @action.bound onScroll(ev: React.UIEvent<HTMLDivElement>) {
        const { scrollTop, scrollHeight } = ev.currentTarget
        const { numTotalRows } = this

        const rowOffset = Math.round((scrollTop / scrollHeight) * numTotalRows)
        ev.currentTarget.scrollTop = Math.round(
            (rowOffset / numTotalRows) * scrollHeight
        )

        this.rowOffset = rowOffset
    }

    @action.bound onNamespace(selected: Namespace | null) {
        if (selected) this.chosenNamespace = selected
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
        this.rowOffset = 0
        this.scrollElement.scrollTop = 0
    }

    @action.bound selectVariable(variable: Variable) {
        if (this.props.slot.allowMultiple)
            this.chosenVariables = this.chosenVariables.concat(variable)
        else this.chosenVariables = [variable]
    }

    @action.bound unselectVariable(variable: Variable) {
        this.chosenVariables = this.chosenVariables.filter(
            (v) => v.id !== variable.id
        )
    }

    @action.bound toggleVariable(variable: Variable) {
        if (this.chosenVariables.includes(variable)) {
            this.unselectVariable(variable)
        } else {
            this.selectVariable(variable)
        }
    }

    @action.bound onSearchEnter() {
        if (this.searchResults.length > 0) {
            this.selectVariable(this.searchResults[0])
        }
    }

    @action.bound onDismiss() {
        this.props.onDismiss()
    }

    dispose!: IReactionDisposer
    base: React.RefObject<HTMLDivElement> = React.createRef()
    componentDidMount() {
        this.dispose = autorun(() => {
            if (!this.editorData)
                runInAction(() => {
                    this.props.editor.loadNamespace(this.currentNamespace.name)
                    this.props.editor.loadVariableUsageCounts()
                })
        })

        this.initChosenVariables()
    }

    @action.bound private initChosenVariables() {
        const { variableUsageCounts } = this.database
        this.chosenVariables =
            this.props.slot.dimensionsOrderedAsInPersistedSelection.map(
                (d) => ({
                    name: d.column.displayName,
                    id: d.variableId,
                    usageCount: variableUsageCounts.get(d.variableId) ?? 0,
                    datasetName: "",
                })
            )
    }

    componentWillUnmount() {
        this.dispose()
    }

    @action.bound onComplete() {
        this.props.onComplete(this.chosenVariables.map((v) => v.id))
    }
}
