import * as React from 'react'
import {groupBy, each, isString} from '../charts/Util'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import {SelectField} from './Forms'
import ChartEditor from './ChartEditor'
import {DimensionSlot} from '../charts/ChartConfig'
import {defaultTo} from '../charts/Util'
import FuzzySearch from '../charts/FuzzySearch'
import EditorModal from './EditorModal'

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
	@observable.ref chosenNamespace: string|undefined
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
		return this.database.datasets.filter(d => d.namespace == this.currentNamespace)
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
		return this.availableVariables.filter(v => !this.chosenVariables.some(v2 => v.id == v2.id))
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
		const {resultsByDataset} = this
		
		let rows: (string|Variable[])[] = []
		each(resultsByDataset, (variables, datasetName) => {
			rows.push(datasetName)

			for (let i = 0; i < variables.length; i += 2) {
				rows.push(variables.slice(i, i+2))
			}
		})
		return rows
	}

	@computed get numTotalRows(): number {
		return this.searchResultRows.length
	}

	render() {
		const {slot} = this.props
		const {database} = this.props.editor
		const {currentNamespace, searchInput, chosenVariables} = this
		const {rowHeight, rowOffset, numVisibleRows, numTotalRows, searchResultRows} = this

		return <EditorModal>
			<div className="modal-dialog VariableSelector">
				<div className="modal-content">
					<div className="modal-header">
						<button type="button" className="close" onClick={this.onDismiss}><span aria-hidden="true">×</span></button>
						<h4 className="modal-title">Set variable{slot.allowMultiple && 's'} for {slot.name}</h4>
					</div>
					<div className="modal-body">
						<div className="searchResults">
							<SelectField label="Database" options={database.namespaces} value={currentNamespace} onValue={this.onNamespace}/> <input type="search" placeholder="Search..." value={searchInput} onInput={this.onSearchInput} onKeyDown={this.onSearchKeyDown} ref={e => this.searchField = (e as HTMLInputElement)}/>
							<div style={{height: numVisibleRows*rowHeight, 'overflow-y': 'scroll'}} onScroll={this.onScroll} ref={e => this.scrollElement = (e as HTMLDivElement)}>
								<div style={{height: numTotalRows*rowHeight, 'padding-top': rowHeight*rowOffset}}>
									<ul>
										{searchResultRows.slice(rowOffset, rowOffset+numVisibleRows).map(d => {
											if (isString(d)) {
												return <li key={d} style={{'min-width': '100%'}}>
													<h5 dangerouslySetInnerHTML={{__html: this.fuzzy.highlight(searchInput||"", d)}}/>
												</li>
											} else {
												return d.map(v => <li key={v.id} style={{'min-width': '50%'}}>
													<label className="clickable">
														<input type="checkbox" checked={false} onChange={() => this.selectVariable(v)}/> <span dangerouslySetInnerHTML={{__html: this.fuzzy.highlight(searchInput||"", v.name)}}/>
													</label>
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
										<label className="clickable">
											<input type="checkbox" checked={true} onChange={() => this.unselectVariable(d)}/> {d.name}
										</label>
									</li>
								})}
							</ul>
						</div>
					</div>
					<div className="modal-footer">
						<button type="button" className="btn btn-default pull-left" onClick={this.onDismiss}>Close</button>
						<button type="button" className="btn btn-primary" onClick={this.onComplete}>Set variable{slot.allowMultiple && 's'}</button>
					</div>
				</div>
			</div>
		</EditorModal>
	}

	@action.bound onScroll(ev: React.UIEvent<HTMLDivElement>) {
		const {scrollTop, scrollHeight} = ev.currentTarget
		const {numTotalRows} = this

		const rowOffset = Math.round(scrollTop/scrollHeight * numTotalRows)
		ev.currentTarget.scrollTop = Math.round(rowOffset/numTotalRows * scrollHeight)

		this.rowOffset = rowOffset
	}

	@action.bound onNamespace(namespace: string) {
		this.chosenNamespace = namespace
	}

	@action.bound onSearchInput(e: React.KeyboardEvent<HTMLInputElement>) {
		this.searchInput = e.currentTarget.value
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
		this.chosenVariables = this.chosenVariables.filter(v => v.id != variable.id)
	}

    @action.bound onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key == "Enter" && this.searchResults.length > 0) {
			this.selectVariable(this.searchResults[0])
			e.preventDefault()
		}
    }

	@action.bound onDismiss() {
		this.props.onDismiss()
	}

	componentDidMount() {
		this.chosenVariables = this.props.slot.dimensionsWithData.map(d => ({
			name: d.displayName,
			id: d.variableId,
			datasetName: "",
			searchKey: ""
		}))

		this.searchField.focus()
	}

	@action.bound onComplete() {
		this.props.onComplete(this.chosenVariables.map(v => v.id))
	}
}