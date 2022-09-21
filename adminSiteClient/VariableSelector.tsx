import React from "react"
import * as lodash from "lodash"
import { groupBy, isString, sortBy } from "../clientUtils/Util.js"
import {
    computed,
    action,
    observable,
    autorun,
    runInAction,
    IReactionDisposer,
    makeObservable,
} from "mobx"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
    SearchWord,
} from "../clientUtils/search.js"
import { observer } from "mobx-react"
import Select from "react-select"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArchive } from "@fortawesome/free-solid-svg-icons/faArchive"

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

export const VariableSelector = observer(
    class VariableSelector extends React.Component<VariableSelectorProps> {
        chosenNamespace: Namespace | undefined
        searchInput?: string
        isProjection?: boolean
        tolerance?: number
        chosenVariables: Variable[] = []
        searchField!: HTMLInputElement
        scrollElement!: HTMLDivElement

        rowOffset: number = 0
        numVisibleRows: number = 15
        rowHeight: number = 32

        constructor(props: VariableSelectorProps) {
            super(props)

            makeObservable<VariableSelector, "initChosenVariables">(this, {
                chosenNamespace: observable.ref,
                searchInput: observable.ref,
                isProjection: observable.ref,
                tolerance: observable.ref,
                chosenVariables: observable.ref,
                rowOffset: observable,
                numVisibleRows: observable,
                rowHeight: observable,
                database: computed,
                currentNamespace: computed,
                searchWords: computed,
                editorData: computed,
                datasets: computed,
                datasetsByName: computed,
                availableVariables: computed,
                searchResults: computed,
                resultsByDataset: computed,
                searchResultRows: computed,
                numTotalRows: computed,
                onScroll: action.bound,
                onNamespace: action.bound,
                onSearchInput: action.bound,
                selectVariable: action.bound,
                unselectVariable: action.bound,
                toggleVariable: action.bound,
                onSearchEnter: action.bound,
                onDismiss: action.bound,
                initChosenVariables: action.bound,
                onComplete: action.bound,
            })
        }

        get database() {
            return this.props.editor.database
        }

        get currentNamespace() {
            return (
                this.chosenNamespace ??
                this.database.namespaces.find((n) => n.name === "owid")!
            )
        }

        get searchWords(): SearchWord[] {
            const { searchInput } = this
            return buildSearchWordsFromSearchString(searchInput)
        }

        get editorData() {
            return this.database.dataByNamespace.get(this.currentNamespace.name)
        }

        get datasets() {
            if (!this.editorData) return []

            const datasets = this.editorData.datasets

            if (this.currentNamespace.name !== "owid") {
                // The default temporal ordering has no real use for bulk imports
                return sortBy(datasets, (d) => d.name)
            } else {
                return datasets
            }
        }

        get datasetsByName(): lodash.Dictionary<Dataset> {
            return lodash.keyBy(this.datasets, (d) => d.name)
        }

        get availableVariables(): Variable[] {
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

        get searchResults(): Variable[] {
            let results: Variable[] | undefined
            const { searchWords } = this
            if (searchWords.length > 0) {
                const filterFn = filterFunctionForSearchWords(
                    searchWords,
                    (variable: Variable) => [
                        variable.name,
                        variable.datasetName,
                    ]
                )
                results = this.availableVariables.filter(filterFn)
            }
            return results && results.length
                ? results // results.map((result) => result.obj)
                : []
        }

        get resultsByDataset(): { [datasetName: string]: Variable[] } {
            const { searchResults, searchWords, availableVariables } = this
            let datasetListToUse = searchResults
            if (searchWords.length == 0) {
                datasetListToUse = availableVariables
            }
            return groupBy(datasetListToUse, (d) => d.datasetName)
        }

        get searchResultRows() {
            const { resultsByDataset } = this

            const rows: Array<string | Variable[]> = []
            const unsorted = Object.entries(resultsByDataset)
            const sorted = lodash.sortBy(unsorted, ([_, variables]) => {
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

        get numTotalRows(): number {
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
                            Set variable{slot.allowMultiple && "s"} for{" "}
                            {slot.name}
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
                                        (this.scrollElement =
                                            e as HTMLDivElement)
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
                                                                key={
                                                                    dataset.name
                                                                }
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
                                                                    minWidth:
                                                                        "50%",
                                                                }}
                                                            >
                                                                <Toggle
                                                                    value={this.chosenVariables
                                                                        .map(
                                                                            (
                                                                                cv
                                                                            ) =>
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

        onScroll(ev: React.UIEvent<HTMLDivElement>) {
            const { scrollTop, scrollHeight } = ev.currentTarget
            const { numTotalRows } = this

            const rowOffset = Math.round(
                (scrollTop / scrollHeight) * numTotalRows
            )
            ev.currentTarget.scrollTop = Math.round(
                (rowOffset / numTotalRows) * scrollHeight
            )

            this.rowOffset = rowOffset
        }

        onNamespace(selected: Namespace | null) {
            if (selected) this.chosenNamespace = selected
        }

        onSearchInput(input: string) {
            this.searchInput = input
            this.rowOffset = 0
            this.scrollElement.scrollTop = 0
        }

        selectVariable(variable: Variable) {
            if (this.props.slot.allowMultiple)
                this.chosenVariables = this.chosenVariables.concat(variable)
            else this.chosenVariables = [variable]
        }

        unselectVariable(variable: Variable) {
            this.chosenVariables = this.chosenVariables.filter(
                (v) => v.id !== variable.id
            )
        }

        toggleVariable(variable: Variable) {
            if (this.chosenVariables.includes(variable)) {
                this.unselectVariable(variable)
            } else {
                this.selectVariable(variable)
            }
        }

        onSearchEnter() {
            if (this.searchResults.length > 0) {
                this.selectVariable(this.searchResults[0])
            }
        }

        onDismiss() {
            this.props.onDismiss()
        }

        dispose!: IReactionDisposer
        base: React.RefObject<HTMLDivElement> = React.createRef()
        componentDidMount() {
            this.dispose = autorun(() => {
                if (!this.editorData)
                    runInAction(() => {
                        this.props.editor.loadNamespace(
                            this.currentNamespace.name
                        )
                        this.props.editor.loadVariableUsageCounts()
                    })
            })

            this.initChosenVariables()
        }

        private initChosenVariables() {
            const { variableUsageCounts } = this.database
            this.chosenVariables = this.props.slot.dimensions.map((d) => ({
                name: d.column.displayName,
                id: d.variableId,
                usageCount: variableUsageCounts.get(d.variableId) ?? 0,
                datasetName: "",
            }))
        }

        componentWillUnmount() {
            this.dispose()
        }

        onComplete() {
            this.props.onComplete(this.chosenVariables.map((v) => v.id))
        }
    }
)
