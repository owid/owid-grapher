import * as React from 'react'
import { action } from 'mobx'
import { observer } from 'mobx-react'
import ChartEditor from './ChartEditor'
import { Toggle, TextField, TextAreaField } from './Forms'

@observer
export default class EditorTextTab extends React.Component<{ editor: ChartEditor }> {
    get chart() {
        return this.props.editor.chart
    }

    lastTitle: string

    @action.bound onTitle(title: string|undefined) { this.chart.props.title = title||"" }
    @action.bound onToggleAutoTitle(value: boolean) { this.chart.props.title = value ? undefined : this.chart.data.defaultTitle }

    @action.bound onSlug(slug: string) { this.chart.props.slug = slug || undefined }
    @action.bound onToggleAutoSlug(value: boolean) { this.chart.props.slug = value ? undefined : this.chart.data.defaultSlug }

    @action.bound onToggleTitleAnnotation(value: boolean) { this.chart.props.hideTitleAnnotation = value || undefined }
    @action.bound onSubtitle(value: string) { this.chart.props.subtitle = value || undefined }

    @action.bound onSource(sourceDesc: string|undefined) { this.chart.props.sourceDesc = sourceDesc||"" }
    @action.bound onToggleAutoSource(value: boolean) { this.chart.props.sourceDesc = value ? undefined : this.chart.data.defaultSourcesLine }

    @action.bound onNote(value: string|undefined) { this.chart.props.note = value || undefined }
    @action.bound onInternalNotes(value: string) { this.chart.props.internalNotes = value || undefined }

    render() {
        const { chart } = this

        return <div className="tab-pane active">
            <TextField label="Title" value={chart.data.title} onValue={this.onTitle}/>
            <Toggle label="Automatic title" value={chart.props.title === undefined} onValue={this.onToggleAutoTitle}/>
            <TextField label="/grapher/" value={chart.data.slug} onValue={this.onSlug} title="Human-friendly URL slug for this chart" />
            <Toggle label="Automatic slug" value={chart.props.slug === undefined} onValue={this.onToggleAutoSlug}/>
            <Toggle label="Hide automatic time/entity" value={!!chart.props.hideTitleAnnotation} onValue={this.onToggleTitleAnnotation} />
            <TextAreaField label="Subtitle" value={chart.props.subtitle} onValue={this.onSubtitle} placeholder="Briefly describe the context of the data" />
            <TextField label="Source" style={{ width: "90%" }} value={chart.data.sourcesLine} onValue={this.onSource}/>
            <Toggle label="Automatic source" value={chart.props.sourceDesc === undefined} onValue={this.onToggleAutoSource}/>
            <TextField label="Footer note" value={chart.props.note} onValue={this.onNote} helpText="Any important clarification needed to avoid miscommunication" />
            <TextAreaField label="Internal author notes" value={chart.props.internalNotes} onValue={this.onInternalNotes} placeholder="e.g. WIP, needs review, etc" />
        </div>
    }
}
