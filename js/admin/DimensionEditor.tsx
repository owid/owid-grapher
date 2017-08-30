import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import {SelectField, Toggle, NumberField} from './Forms'
import ChartEditor from './ChartEditor'
import ChartConfig, {DimensionSlot, ChartDimension} from '../charts/ChartConfig'
import {defaultTo} from '../charts/Util'
import {EditorDatabase, Variable} from './ChartEditor'
const Fuse = require("fuse.js")

interface DimensionEditorProps {
	editor: ChartEditor,
	dimension: ChartDimension,
	onDismiss: () => void,
	onComplete: (dimension: ChartDimension) => void
}

@observer
export default class DimensionEditor extends React.Component<DimensionEditorProps> {
	@observable.ref chosenNamespace: string|undefined
	@observable.ref chosenVariableId: number|undefined
    @observable.ref searchInput?: string
	@observable.ref isProjection?: true
	@observable.ref tolerance?: number
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

	@computed get variableId() {
		if (this.chosenVariableId != null)
			return this.chosenVariableId
		else
			return this.searchResults[0].id
	}

	@computed get variables() {
		const variables: { id: number, name: string }[] = []
		this.datasets.forEach(dataset => {
			dataset.variables.forEach(variable => {
				variables.push({
					id: variable.id,
					name: variable.name.includes(dataset.name) ? variable.name : dataset.name + " - " + variable.name
				})
			})
		})
		return variables
	}

    @computed get fuseSearch(): any {
        return new Fuse(this.variables, {
            shouldSort: true,
            threshold: 0.6,
            location: 0,
            distance: 100,
            maxPatternLength: 32,
            minMatchCharLength: 1,
            keys: ["name"]
        });
    }

    @computed get searchResults(): Variable[] {
		return this.searchInput ? this.fuseSearch.search(this.searchInput) : this.variables
    }

	@action.bound onNamespace(namespace: string) {
		this.chosenVariableId = undefined
		this.chosenNamespace = namespace
	}

	@action.bound onSearchInput(e: React.KeyboardEvent<HTMLInputElement>) {
		this.chosenVariableId = undefined
		this.searchInput = e.currentTarget.value
	}

    @action.bound onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key == "Enter" && this.searchResults.length > 0) {
            //this.props.chart.data.toggleKey(this.searchResults[0].key)
			this.onComplete()
			e.preventDefault()
        } else if (e.key == "Escape")
            this.props.onDismiss()
    }

	@action.bound onVariable(ev: React.FormEvent<HTMLSelectElement>) {
		this.chosenVariableId = parseInt(ev.currentTarget.value)
	}

	@action.bound onDismiss() {
		this.props.onDismiss()
	}

	@action.bound onComplete() {
		this.props.onComplete(this.dimension)
	}

	@computed get dimension(): ChartDimension {
		return _.extend({}, this.props.dimension, {
			variableId: this.variableId,
			isProjection: this.isProjection,
			tolerance: this.tolerance
		})
/*		return {
			variableId: this.variableId,
			color?: string,
			displayName?: string,    
			isProjection?: boolean,
			order: number,
			property: string,
			targetYear?: number,
			tolerance: number,
			unit?: string
			
		}*/
	}
	
	componentDidMount() {
		this.isProjection = this.props.dimension.isProjection
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
		}

		if (this.chosenVariableId == null)
			this.searchField.focus()
	}

	render() {
		const {chart, database} = this.props.editor
		const {currentNamespace, variables, variableId, searchInput, searchResults, isProjection, tolerance} = this

		return <div className="editorModal DimensionEditor">
			<div className="modal-dialog">
				<div className="modal-content">
					<div className="modal-header">
						<button type="button" className="close" onClick={this.onDismiss}><span aria-hidden="true">×</span></button>
						<h4 className="modal-title">Select variable from database</h4>
					</div>
					<div className="modal-body">
						<div className="form-variable-select-wrapper">
							<SelectField label="Database" options={database.namespaces} value={currentNamespace} onValue={this.onNamespace}/> <input type="search" placeholder="Search..." value={searchInput} onInput={this.onSearchInput} onKeyDown={this.onSearchKeyDown} ref={e => this.searchField = (e as HTMLInputElement)}/>
							<label className="variable-wrapper">
								Variable:
								<select data-placeholder="Select your variable" className="form-control form-variable-select chosen-select" onChange={this.onVariable} value={variableId}>
									{searchResults.map(variable => {
										return <option value={variable.id}>{variable.name}</option>
									})}
								</select>
							</label>
							{chart.isLineChart && <Toggle label="Is projection" value={!!isProjection} onValue={value => this.isProjection = value||undefined}/>}
							{chart.isScatter && <NumberField label="Tolerance" value={tolerance} onValue={value => this.tolerance = value}/>}
						</div>
					</div>
					<div className="modal-footer">
						<button type="button" className="btn btn-default pull-left" onClick={this.onDismiss}>Close</button>
						<button type="button" className="btn btn-primary" onClick={this.onComplete}>{this.props.dimension.variableId == -1 ? "Add variable" : "Update variable"}</button>
					</div>
				</div>
			</div>
		</div>
	}
}