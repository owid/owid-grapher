import * as React from 'react'
import { groupBy, each, isString } from '../charts/Util'
import { computed, action, observable } from 'mobx'
import { observer } from 'mobx-react'
import ChartEditor from './ChartEditor'
import { DimensionSlot } from '../charts/ChartConfig'
import { defaultTo } from '../charts/Util'
import FuzzySearch from '../charts/FuzzySearch'
import { SelectField, TextField, FieldsRow, Toggle } from './Forms'
import { Form, Modal, Button } from 'semantic-ui-react'

interface VariableSelectorProps {
    editor: ChartEditor
    slot: DimensionSlot
    onDismiss: () => void
    onComplete: (variableIds: number[]) => void
}

interface Variable {
    id: number
    name: string,
    datasetName: string,
    searchKey: string
}

@observer
export default class VariableSelector extends React.Component<VariableSelectorProps> {
    @observable.ref chosenNamespace: string | undefined
    @observable.ref searchInput?: string
    @observable.ref isProjection?: true
    @observable.ref tolerance?: number
    @observable.ref chosenVariables: Variable[] = []
    searchField: HTMLInputElement
    scrollElement: HTMLDivElement

    @observable rowOffset: number = 0
    @observable numVisibleRows: number = 15
    @observable rowHeight: number = 32

    @computed get database() {
        return this.props.editor.database
    }

    @computed get currentNamespace() {
        return defaultTo(this.chosenNamespace, this.database.namespaces[0])
    }

    @computed get datasets() {
        return this.database.datasets.filter(d => d.namespace === this.currentNamespace)
    }

    @computed get availableVariables(): Variable[] {
        const variables: Variable[] = []
        this.datasets.forEach(dataset => {
            dataset.variables.forEach(variable => {
                variables.push({
                    id: variable.id,
                    name: variable.name,
                    datasetName: dataset.name,
                    searchKey: dataset.name + " - " + variable.name
                    //name: variable.name.includes(dataset.name) ? variable.name : dataset.name + " - " + variable.name
                })
            })
        })
        return variables
    }

    @computed get unselectedVariables(): Variable[] {
        return this.availableVariables.filter(v => !this.chosenVariables.some(v2 => v.id === v2.id))
    }

    @computed get fuzzy(): FuzzySearch<Variable> {
        return new FuzzySearch(this.unselectedVariables, 'searchKey')
    }

    @computed get searchResults(): Variable[] {
        const results = this.searchInput && this.fuzzy.search(this.searchInput)
        return (results && results.length) ? results : this.unselectedVariables
    }

    @computed get resultsByDataset(): { [datasetName: string]: Variable[] } {
        return groupBy(this.searchResults, d => d.datasetName)
    }

    @computed get searchResultRows() {
        const { resultsByDataset } = this

        const rows: Array<(string | Variable[])> = []
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
        const { currentNamespace, searchInput, chosenVariables } = this
        const { rowHeight, rowOffset, numVisibleRows, numTotalRows, searchResultRows } = this

        return <Modal size="large" open={true} onClose={this.onDismiss} className="VariableSelector">
            <Modal.Header>
                Set variable{slot.allowMultiple && 's'} for {slot.name}
            </Modal.Header>
            <Modal.Content>
                <Form>
                    <div className="searchResults">
                        <FieldsRow>
                            <SelectField label="Database" options={database.namespaces} value={currentNamespace} onValue={this.onNamespace}/>
                            <TextField placeholder="Search..." value={searchInput} onValue={this.onSearchInput} onEnter={this.onSearchEnter} autofocus/>
                        </FieldsRow>
                        <div style={{ height: numVisibleRows * rowHeight, 'overflow-y': 'scroll' }} onScroll={this.onScroll} ref={e => this.scrollElement = (e as HTMLDivElement)}>
                            <div style={{ height: numTotalRows * rowHeight, 'padding-top': rowHeight * rowOffset }}>
                                <ul>
                                    {searchResultRows.slice(rowOffset, rowOffset + numVisibleRows).map(d => {
                                        if (isString(d)) {
                                            return <li key={d} style={{ 'min-width': '100%' }}>
                                                <h5 dangerouslySetInnerHTML={{ __html: this.fuzzy.highlight(searchInput || "", d) }}>{d}</h5>
                                            </li>
                                        } else {
                                            return d.map(v => <li key={v.id} style={{ 'min-width': '50%' }}>
                                                <Toggle value={false} onValue={() => this.selectVariable(v)} label={<label dangerouslySetInnerHTML={{ __html: this.fuzzy.highlight(searchInput || "", v.name) }}>{v.name}</label>}/>
                                                {/*<label className="clickable">
                                                    <input type="checkbox" checked={false} onChange={() => this.selectVariable(v)} /> <span dangerouslySetInnerHTML={{ __html: this.fuzzy.highlight(searchInput || "", v.name) }}>{v.name}</span>
                                        </label>*/}
                                            </li>)
                                        }
                                    })}
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div className="selectedData">
                        <ul>
                            {chosenVariables.map(d => {
                                return <li>
                                    <Toggle value={true} onValue={() => this.unselectVariable(d)} label={d.name}/>
                                    {/*<label className="clickable">
                                        <input type="checkbox" checked={true} onChange={() => this.unselectVariable(d)} /> {d.name}
                            </label>*/}
                                </li>
                            })}
                        </ul>
                    </div>
                </Form>
            </Modal.Content>
            <Modal.Actions>
                <Button onClick={this.onDismiss}>Close</Button>
                <Button primary onClick={this.onComplete}>Set variable{slot.allowMultiple && 's'}</Button>
            </Modal.Actions>
        </Modal>
    }

    @action.bound onScroll(ev: React.UIEvent<HTMLDivElement>) {
        const { scrollTop, scrollHeight } = ev.currentTarget
        const { numTotalRows } = this

        const rowOffset = Math.round(scrollTop / scrollHeight * numTotalRows)
        ev.currentTarget.scrollTop = Math.round(rowOffset / numTotalRows * scrollHeight)

        this.rowOffset = rowOffset
    }

    @action.bound onNamespace(namespace: string) {
        this.chosenNamespace = namespace
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
        this.rowOffset = 0
        this.scrollElement.scrollTop = 0
    }

    @action.bound selectVariable(variable: Variable) {
        if (this.props.slot.allowMultiple)
            this.chosenVariables = this.chosenVariables.concat(variable)
        else
            this.chosenVariables = [variable]
    }

    @action.bound unselectVariable(variable: Variable) {
        this.chosenVariables = this.chosenVariables.filter(v => v.id !== variable.id)
    }

    @action.bound onSearchEnter() {
        if (this.searchResults.length > 0) {
            this.selectVariable(this.searchResults[0])
        }
    }

    @action.bound onDismiss() {
        this.props.onDismiss()
    }

    base: HTMLDivElement
    componentDidMount() {
        this.chosenVariables = this.props.slot.dimensionsWithData.map(d => ({
            name: d.displayName,
            id: d.variableId,
            datasetName: "",
            searchKey: ""
        }))
    }

    @action.bound onComplete() {
        this.props.onComplete(this.chosenVariables.map(v => v.id))
    }
}
