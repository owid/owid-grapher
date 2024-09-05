import React from "react"
import * as lodash from "lodash"
import {
    groupBy,
    sortBy,
    OwidVariableId,
    excludeUndefined,
    uniq,
    isNumber,
} from "@ourworldindata/utils"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
    SearchWord,
} from "../adminShared/search.js"
import { computed, action, observable, IReactionDisposer } from "mobx"
import { observer } from "mobx-react"
import Select, { MultiValue } from "react-select"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArchive } from "@fortawesome/free-solid-svg-icons"

import {
    Dataset,
    EditorDatabase,
    Namespace,
    NamespaceData,
} from "./ChartEditorView.js"
import { TextField, Toggle, Modal } from "./Forms.js"
import { DimensionSlot } from "@ourworldindata/grapher"
import { AbstractChartEditor } from "./AbstractChartEditor.js"

interface VariableSelectorProps<Editor> {
    database: EditorDatabase
    editor: Editor
    slot: DimensionSlot
    onDismiss: () => void
    onComplete: (variableIds: OwidVariableId[]) => void
}

interface Variable {
    id: number
    name: string
    datasetId: number
    datasetName: string
    datasetVersion?: string
    namespaceName: string
    usageCount: number
}

@observer
export class VariableSelector<
    Editor extends AbstractChartEditor,
> extends React.Component<VariableSelectorProps<Editor>> {
    @observable.ref chosenNamespaces: Namespace[] = []
    @observable.ref searchInput?: string
    @observable.ref isProjection?: boolean
    @observable.ref tolerance?: number
    @observable.ref chosenVariables: Variable[] = []
    searchField!: HTMLInputElement
    scrollElement!: HTMLDivElement

    @observable rowOffset: number = 0
    @observable numVisibleRows: number = 15
    @observable rowHeight: number = 32

    @computed get database(): EditorDatabase {
        return this.props.database
    }

    @computed get searchWords(): SearchWord[] {
        const { searchInput } = this
        return buildSearchWordsFromSearchString(searchInput)
    }

    @computed get editorData(): NamespaceData[] {
        // show all variables when no namespaces are selected
        const currentNamespaces =
            this.chosenNamespaces.length > 0
                ? this.chosenNamespaces
                : this.database.namespaces

        return excludeUndefined(
            currentNamespaces.map((namespace) =>
                this.database.dataByNamespace.get(namespace.name)
            )
        )
    }

    @computed get datasets(): Dataset[] {
        const datasets = this.editorData.flatMap((d) => d.datasets)
        return sortBy(datasets, (d) => d.name)
    }

    @computed get datasetsById(): Record<number, Dataset> {
        return lodash.keyBy(this.datasets, (d) => d.id)
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
                    datasetId: dataset.id,
                    datasetName: dataset.name,
                    datasetVersion: dataset.version,
                    namespaceName: dataset.namespace,
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

    @computed get resultsByDataset(): { [datasetId: number]: Variable[] } {
        const { searchResults, searchWords, availableVariables } = this
        let datasetListToUse = searchResults
        if (searchWords.length === 0) {
            datasetListToUse = availableVariables
        }
        return groupBy(datasetListToUse, (d) => d.datasetId)
    }

    @computed get searchResultRows() {
        const { resultsByDataset } = this

        const rows: Array<number | Variable[]> = []
        const unsorted = Object.entries(resultsByDataset)
        const sorted = lodash.sortBy(unsorted, ([_, variables]) => {
            const sizes = lodash.map(
                variables,
                (variable) => variable.usageCount ?? 0
            )
            return Math.max(...sizes) * -1
        })
        sorted.forEach(([datasetId, variables]) => {
            rows.push(parseInt(datasetId))

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
        const { database } = this.props
        const {
            searchInput,
            chosenVariables,
            datasetsById,
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
                        Set indicator{slot.allowMultiple && "s"} for {slot.name}
                    </h5>
                </div>
                <div className="modal-body">
                    <div>
                        <div className="searchResults">
                            <TextField
                                placeholder="Search..."
                                value={searchInput}
                                onValue={this.onSearchInput}
                                onEnter={this.onSearchEnter}
                                onEscape={this.onDismiss}
                                autofocus
                            />
                            <div className="form-group">
                                <label>Namespaces</label>
                                <Select
                                    options={database.namespaces}
                                    value={this.chosenNamespaces}
                                    formatOptionLabel={
                                        this.formatNamespaceLabel
                                    }
                                    getOptionValue={(v) => v.name}
                                    onChange={this.onNamespace}
                                    filterOption={this.filterNamespace}
                                    components={{
                                        IndicatorSeparator: null,
                                    }}
                                    menuPlacement="bottom"
                                    isMulti
                                    styles={{
                                        multiValue: (baseStyles) => ({
                                            ...baseStyles,
                                            maxWidth: "300px",
                                        }),
                                        valueContainer: (baseStyles) => ({
                                            ...baseStyles,
                                            overflowY: "auto",
                                            maxHeight: "130px",
                                        }),
                                    }}
                                />
                            </div>
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
                                                if (isNumber(d)) {
                                                    const dataset =
                                                        datasetsById[d]
                                                    return (
                                                        <li
                                                            key={dataset.id}
                                                            style={{
                                                                minWidth:
                                                                    "100%",
                                                            }}
                                                        >
                                                            <h5
                                                                style={{
                                                                    marginTop:
                                                                        "4px",
                                                                }}
                                                            >
                                                                [
                                                                {
                                                                    dataset.namespace
                                                                }
                                                                ]{" "}
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
                                                                {dataset.version && (
                                                                    <small
                                                                        style={{
                                                                            marginLeft: 10,
                                                                        }}
                                                                    >
                                                                        {
                                                                            dataset.version
                                                                        }
                                                                    </small>
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
                                                                    <div
                                                                        style={{
                                                                            overflowWrap:
                                                                                "anywhere",
                                                                        }}
                                                                    >
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
                                                                    </div>
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
                        <div
                            className="selectedData"
                            style={{ maxWidth: "33.33%" }}
                        >
                            <ul>
                                {chosenVariables.map((d) => {
                                    const label = (
                                        <React.Fragment>
                                            {d.name}{" "}
                                            <span style={{ color: "#999" }}>
                                                [{d.namespaceName}:{" "}
                                                {d.datasetName}
                                                {d.datasetVersion &&
                                                    ` (${d.datasetVersion})`}
                                                ]
                                            </span>
                                        </React.Fragment>
                                    )

                                    return (
                                        <li key={d.id}>
                                            <Toggle
                                                value={true}
                                                onValue={() =>
                                                    this.unselectVariable(d)
                                                }
                                                label={label}
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

    @action.bound onNamespace(selected: MultiValue<Namespace> | null) {
        if (selected) this.chosenNamespaces = [...selected]
    }

    @action.bound onSearchInput(input: string) {
        if (this.searchInput !== input) {
            this.searchInput = input
            this.rowOffset = 0
            this.scrollElement.scrollTop = 0
        }
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
        if (this.chosenVariables.map((v) => v.id).includes(variable.id)) {
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
        this.initChosenVariablesAndNamespaces()
    }

    @action.bound private initChosenVariablesAndNamespaces() {
        const { datasetsById } = this
        const { variableUsageCounts } = this.database
        const { dimensions } = this.props.slot

        this.chosenVariables = dimensions.map((d) => {
            const { datasetName, datasetId } = d.column
            const dataset =
                datasetId !== undefined ? datasetsById[datasetId] : undefined

            return {
                name: d.column.name,
                id: d.variableId,
                usageCount: variableUsageCounts.get(d.variableId) ?? 0,
                datasetId: datasetId ?? 0,
                datasetName: datasetName || "",
                catalogPath: undefined,
                namespaceName: dataset?.namespace ?? "",
                datasetVersion: dataset?.version,
            }
        })

        const uniqueNamespaces = uniq(
            this.chosenVariables.map((v) => v.namespaceName)
        )
        this.chosenNamespaces = this.database.namespaces.filter((n) => {
            return uniqueNamespaces.includes(n.name)
        })
    }

    @action.bound onComplete() {
        this.props.onComplete(this.chosenVariables.map((v) => v.id))
    }
}
