import * as React from 'react'
import { action } from 'mobx'
import { observer } from 'mobx-react'
import { ChartEditor } from './ChartEditor'
import { Toggle, Section, BindString, BindAutoString, AutoTextField } from './Forms'
const slugify = require('slugify')

@observer
export class EditorTextTab extends React.Component<{ editor: ChartEditor }> {
    @action.bound onSlug(slug: string) {
        this.props.editor.chart.props.slug = slugify(slug).toLowerCase()
    }

    @action.bound onToggleLogo(value: boolean) {
        this.props.editor.chart.props.hideLogo = value||undefined
    }

    render() {
        const {chart} = this.props.editor

        return <div>
            <Section name="Header">
                <BindAutoString field="title" store={chart.props} auto={chart.data.title} softCharacterLimit={100}/>
                <Toggle label="Hide automatic time/entity" value={!!chart.props.hideTitleAnnotation} onValue={action((value: boolean) => chart.props.hideTitleAnnotation = value||undefined)}/>
                <AutoTextField label="/grapher" value={chart.data.slug} onValue={this.onSlug} isAuto={chart.props.slug === undefined} onToggleAuto={_ => chart.props.slug = chart.props.slug === undefined ? chart.data.slug : undefined} helpText="Human-friendly URL for this chart"/>
                <BindString field="subtitle" store={chart.props} placeholder="Briefly describe the context of the data. It's best to avoid duplicating any information which can be easily inferred from other visual elements of the chart." textarea softCharacterLimit={280}/>
                <Toggle label="Hide logo" value={!!chart.props.hideLogo} onValue={this.onToggleLogo}/>
            </Section>
            <Section name="Footer">
                <BindAutoString label="Source" field="sourceDesc" store={chart.props} auto={chart.data.sourcesLine} helpText="Short comma-separated list of source names" softCharacterLimit={60}/>
                <BindString label="Origin url" field="originUrl" store={chart.props} placeholder={chart.data.originUrl} helpText="The page containing this chart where more context can be found"/>
                <BindString label="Footer note" field="note" store={chart.props} helpText="Any important clarification needed to avoid miscommunication" softCharacterLimit={140}/>
            </Section>
            <Section name="Misc">
                <BindString label="Internal author notes" field="internalNotes" store={chart.props} placeholder="e.g. WIP, needs review, etc" textarea/>
            </Section>
        </div>
    }
}
