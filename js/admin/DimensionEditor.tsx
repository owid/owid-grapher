import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import {SelectField, Toggle, NumberField} from './Forms'
import ChartEditor from './ChartEditor'
import ChartConfig, {DimensionSlot, ChartDimension} from '../charts/ChartConfig'
import {defaultTo} from '../charts/Util'

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

	@computed get currentNamespace() {
		return defaultTo(this.chosenNamespace, this.props.editor.data.namespaces[0])
	}

	@computed get variables() {
		return _.filter(this.props.editor.data.variables, v => v.dataset.namespace == this.currentNamespace)
	}

	@computed get variablesByCategory() {
		return _.groupBy(this.variables, v => v.dataset.subcategory)
	}

	@computed get variablesById() {
		return _.keyBy(this.variables, 'id')
	}

	@computed get variableId() {
		return defaultTo(this.chosenVariableId, this.variables[0].id)
	}

	@action.bound onNamespace(namespace: string) {
		this.chosenVariableId = undefined
		this.chosenNamespace = namespace
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
			variableId: this.variableId
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

	render() {
		const {chart} = this.props.editor
		const {namespaces} = this.props.editor.data
		const {currentNamespace, variablesByCategory, variableId} = this

		return <div className="editorModal DimensionEditor">
			<div className="modal-dialog">
				<div className="modal-content">
					<div className="modal-header">
						<button type="button" className="close" onClick={this.onDismiss}><span aria-hidden="true">×</span></button>
						<h4 className="modal-title">Select variable from database</h4>
					</div>
					<div className="modal-body">
						<div className="form-variable-select-wrapper">
							<SelectField label="Database" options={namespaces} value={currentNamespace} onValue={this.onNamespace}/>
							
							<label className="variable-wrapper">
								Variable:
								<select data-placeholder="Select your variable" className="form-control form-variable-select chosen-select" onChange={this.onVariable} value={variableId}>
									{_.map(variablesByCategory, (variables, category) => {
										return <optgroup label={category}>
											{_.map(variables, variable => 
												<option title={variable.description} value={variable.id}>{variable.name}</option>
											)}
										</optgroup>
									})}
								</select>
							</label>
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