import * as React from 'react'
import { action } from 'mobx'
import { observer } from 'mobx-react'
import ChartEditor from './ChartEditor'
import { Toggle, Section, BindString, BindAutoString } from './Forms'

@observer
export default class EditorTextTab extends React.Component<{ editor: ChartEditor }> {
    render() {
        const {chart} = this.props.editor

        return <div>
            <Section name="Header">
                <BindAutoString field="title" store={chart.props} auto={chart.data.title} softCharacterLimit={100}/>
                <Toggle label="Hide automatic time/entity" value={!!chart.props.hideTitleAnnotation} onValue={action((value: boolean) => chart.props.hideTitleAnnotation = value||undefined)}/>
                <BindAutoString label="/grapher/" field="slug" store={chart.props} auto={chart.data.slug} helpText="Human-friendly URL for this chart"/>
                <BindString field="subtitle" store={chart.props} placeholder="Briefly describe the context of the data" textarea softCharacterLimit={280}/>
            </Section>
            <Section name="Footer">
                <BindAutoString label="Source" field="sourceDesc" store={chart.props} auto={chart.data.sourcesLine} softCharacterLimit={60}/>
                <BindString label="Origin url" field="originUrl" store={chart.props} placeholder={chart.data.originUrl} helpText="The page containing this chart where more context can be found"/>
                <BindString label="Footer note" field="note" store={chart.props} helpText="Any important clarification needed to avoid miscommunication" softCharacterLimit={140}/>
            </Section>
            <Section name="Misc">
                <BindString label="Internal author notes" field="internalNotes" store={chart.props} placeholder="e.g. WIP, needs review, etc" textarea/>
            </Section>
        </div>
    }
}
