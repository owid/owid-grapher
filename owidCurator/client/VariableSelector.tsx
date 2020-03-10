import * as React from "react"
import * as _ from "lodash"
import { groupBy, each, isString, sortBy } from "charts/Util"
import {
    computed,
    action,
    observable,
    autorun,
    runInAction,
    IReactionDisposer
} from "mobx"
import { observer } from "mobx-react"
import { ChartEditor, Dataset, Namespace } from "./ChartEditor"
import { DimensionSlot } from "charts/ChartConfig"
import { defaultTo } from "charts/Util"
import { SelectField, TextField, FieldsRow, Toggle, Modal } from "./Forms"
const fuzzysort = require("fuzzysort")

interface VariableSelectorProps {
    editor: ChartEditor
    slot: DimensionSlot
    onDismiss: () => void
    onComplete: (variableIds: number[]) => void
}

interface Variable {
    id: number
    name: string
    datasetName: string
    searchKey: string
}

@observer
export class VariableSelector extends React.Component<VariableSelectorProps> {
    @observable.ref chosenNamespace: Namespace | undefined
    @observable.ref searchInput?: string
    @observable.ref isProjection?: true
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
        return defaultTo(
            this.chosenNamespace,
            this.database.namespaces.find(n => n.name === "owid") as Namespace
        )
    }

    @computed get editorData() {
        return this.database.dataByNamespace.get(this.currentNamespace.name)
    }

    @computed get datasets() {
        if (!this.editorData) return []

        const datasets = this.editorData.datasets

        if (this.currentNamespace.name !== "owid") {
            // The default temporal ordering has no real use for bulk imports
            return sortBy(datasets, d => d.name)
        } else {
            return datasets
        }
    }

    @computed get datasetsByName(): _.Dictionary<Dataset> {
        return _.keyBy(this.datasets, d => d.name)
    }

    @computed get availableVariables(): Variable[] {
        const variables: Variable[] = []
        this.datasets.forEach(dataset => {
            const sorted = sortBy(dataset.variables, v => v.name)
            sorted.forEach(variable => {
                variables.push({
                    id: variable.id,
                    name: variable.name,
                    datasetName: dataset.name,
                    searchKey: fuzzysort.prepare(
                        dataset.name + " - " + variable.name
                    )
                    //name: variable.name.includes(dataset.name) ? variable.name : dataset.name + " - " + variable.name
                })
            })
        })
        return variables
    }

    @computed get searchResults(): Variable[] {
        const results =
            this.searchInput &&
            fuzzysort.go(this.searchInput, this.availableVariables, {
                key: "searchKey"
            })
        return results && results.length
            ? results.map((result: any) => result.obj)
            : this.availableVariables
    }

    @computed get resultsByDataset(): { [datasetName: string]: Variable[] } {
        return groupBy(this.searchResults, d => d.datasetName)
    }

    @computed get searchResultRows() {
        const { resultsByDataset } = this

        const rows: Array<string | Variable[]> = []
        each(resultsByDataset, (variables, datasetName) => {
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

    render() {
        const { slot } = this.props
        const { database } = this.props.editor
        const {
            currentNamespace,
            searchInput,
            chosenVariables,
            datasetsByName
        } = this
        const {
            rowHeight,
            rowOffset,
            numVisibleRows,
            numTotalRows,
            searchResultRows
        } = this

        const highlight = (text: string) => {
            if (this.searchInput) {
                const html =
                    fuzzysort.highlight(
                        fuzzysort.single(this.searchInput, text)
                    ) || text
                return <span dangerouslySetInnerHTML={{ __html: html }} />
            } else return text
        }

        const getOptionLabel = (namespace: Namespace) => {
            if (namespace.description)
                return `${namespace.description} — ${namespace.name}`
            else return namespace.name
        }

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
                                <SelectField
                                    label="Database"
                                    options={database.namespaces.map(
                                        n => n.name
                                    )}
                                    optionLabels={database.namespaces.map(
                                        getOptionLabel
                                    )}
                                    value={currentNamespace.name}
                                    onValue={this.onNamespace}
                                />
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
                                    overflowY: "scroll"
                                }}
                                onScroll={this.onScroll}
                                ref={e =>
                                    (this.scrollElement = e as HTMLDivElement)
                                }
                            >
                                <div
                                    style={{
                                        height: numTotalRows * rowHeight,
                                        paddingTop: rowHeight * rowOffset
                                    }}
                                >
                                    <ul>
                                        {searchResultRows
                                            .slice(
                                                rowOffset,
                                                rowOffset + numVisibleRows
                                            )
                                            .map(d => {
                                                if (isString(d)) {
                                                    const dataset =
                                                        datasetsByName[d]
                                                    return (
                                                        <li
                                                            key={dataset.name}
                                                            style={{
                                                                minWidth: "100%"
                                                            }}
                                                        >
                                                            <h5>
                                                                {highlight(
                                                                    dataset.name
                                                                )}
                                                                {dataset.isPrivate ? (
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
                                                    return d.map(v => (
                                                        <li
                                                            key={`${v.id}-${v.name}`}
                                                            style={{
                                                                minWidth: "50%"
                                                            }}
                                                        >
                                                            <Toggle
                                                                value={this.chosenVariables
                                                                    .map(
                                                                        cv =>
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
                                                                label={highlight(
                                                                    v.name
                                                                )}
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
                                {chosenVariables.map(d => {
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

    @action.bound onNamespace(namespace: string | undefined) {
        this.chosenNamespace = this.database.namespaces.find(
            n => n.name === namespace
        )
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
            v => v.id !== variable.id
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
                runInAction(() =>
                    this.props.editor.loadNamespace(this.currentNamespace.name)
                )
        })

        this.chosenVariables = this.props.slot.dimensionsWithData.map(d => ({
            name: d.displayName,
            id: d.variableId,
            datasetName: "",
            searchKey: ""
        }))
    }

    componentWillUnmount() {
        this.dispose()
    }

    @action.bound onComplete() {
        this.props.onComplete(this.chosenVariables.map(v => v.id))
    }
}
