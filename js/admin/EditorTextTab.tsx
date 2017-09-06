import * as _ from 'lodash'
import * as React from 'react'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartEditor from './ChartEditor'
import {ChartTypeType} from '../charts/ChartType'
import {Toggle, TextField, TextAreaField} from './Forms'
import {slugify} from '../charts/Util'

@observer
export default class EditorTextTab extends React.Component<{ editor: ChartEditor }> {
	get chart() {
		return this.props.editor.chart
	}

	lastTitle: string

	@action.bound onTitle(title: string) { this.chart.props.title = title||undefined }
	@action.bound onSlug(slug: string) { this.chart.props.slug = slug||undefined }
	@action.bound onToggleTitleAnnotation(value: boolean) { this.chart.props.hideTitleAnnotation = value||undefined }
	@action.bound onSubtitle(evt: React.FormEvent<HTMLTextAreaElement>) { this.chart.props.subtitle = evt.currentTarget.value }
	@action.bound onSource(sourceDesc: string) { this.chart.props.sourceDesc = sourceDesc||undefined }
	@action.bound onNote(evt: React.FormEvent<HTMLTextAreaElement>) { this.chart.props.note = evt.currentTarget.value }
	@action.bound onInternalNotes(evt: React.FormEvent<HTMLTextAreaElement>) { this.chart.props.internalNotes = evt.currentTarget.value }

	render() {
		const { chart } = this

		return <div className="tab-pane active">
			<section>
				<h2>Title of the visualization</h2>
                <TextField value={chart.props.title} onValue={this.onTitle} style={{width: "100%"}} placeholder={chart.data.title}/>
				<div className="input-group">
					<span className="input-group-addon">/grapher/</span>
                    <TextField value={chart.props.slug} onValue={this.onSlug} placeholder={chart.data.slug} title="Human-friendly URL slug for this chart"/>
				</div>
				<Toggle label="Hide automatic time/entity" value={!!chart.props.hideTitleAnnotation} onValue={this.onToggleTitleAnnotation}/>
			</section>	
			<section>
				<h2>Subtitle of the visualization</h2>
				<textarea className="form-control input-lg .col-xs-12" placeholder="Briefly describe the context of the data" value={chart.subtitle} onInput={this.onSubtitle} />
	   		</section>
			<section>
				<h2>Sources</h2>
				<TextAreaField value={chart.props.sourceDesc} onValue={this.onSource} placeholder={chart.data.sourcesLine}/>
			</section>
			<section>
				<h2>Footer note</h2>
				<textarea className="form-control input-lg .col-xs-12" placeholder="Any further relevant information e.g. adjustments or limitations" value={chart.note} onInput={this.onNote}/>
			</section>
			<section>						
				<h2>Internal author notes</h2>						
				<textarea className="form-control input-lg .col-xs-12" placeholder="e.g. WIP, needs review, etc" name="chart-notes" value={chart.internalNotes} onInput={this.onInternalNotes}/>
			</section>
		</div>
	}
}