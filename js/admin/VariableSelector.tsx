import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import {SelectField, Toggle, NumberField} from './Forms'
import ChartEditor from './ChartEditor'
import ChartConfig, {DimensionSlot, ChartDimension} from '../charts/ChartConfig'
import {defaultTo} from '../charts/Util'
import {EditorDatabase} from './ChartEditor'
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

	@computed get database() {
		return this.props.editor.database
	}

	@computed get currentNamespace() {
		return defaultTo(this.chosenNamespace, this.database.namespaces[0])
	}

	@computed get datasets() {
		return _(this.database.datasets).filter(d => d.namespace == this.currentNamespace).value()
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
		return _.groupBy(this.searchResults, d => d.datasetName)
	}

	@action.bound onNamespace(namespace: string) {
		this.chosenNamespace = namespace
	}

	@action.bound onSearchInput(e: React.KeyboardEvent<HTMLInputElement>) {
		this.searchInput = e.currentTarget.value
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
		/*this.isProjection = this.props.dimension.isProjection
		this.tolerance = defaultTo(this.props.dimension.tolerance, 5)

		const variableId = this.props.dimension.variableId
		if (variableId && variableId > 0) {
			this.database.datasets.forEach(dataset => {
				dataset.variables.forEach(variable => {
					if (variable.id == variableId) {
						this.chosenVariableId = variableId
						this.chosenNamespace = dataset.namespace
					}
				})
			})
		}*/

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

	render() {
		const {slot} = this.props
		const {chart, database} = this.props.editor
		const {currentNamespace, searchInput, resultsByDataset, chosenVariables, isProjection, tolerance} = this

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
							{_.map(resultsByDataset, (results, datasetName) => {
								return <div>
									<h5>{datasetName}</h5>
									<ul>
										{results.map(d => 
											<li>
												<label className="clickable">
													<input type="checkbox" checked={false} onChange={e => this.selectVariable(d)}/> {d.name}
												</label>
											</li>
										)}
									</ul>
								</div>
							})}
						</div>
						<div className="selectedData">
							<ul>
								{chosenVariables.map(d => {
									return <li>
										<label className="clickable">
											<input type="checkbox" checked={true} onChange={e => this.unselectVariable(d)}/> {d.name}
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
}