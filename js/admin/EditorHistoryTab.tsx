import * as React from 'react'
import { observer } from "mobx-react"
import ChartEditor, { Log } from './ChartEditor'
import { computed, action, observable } from 'mobx'
import { Section } from './Forms'
const timeago = require('timeago.js')()

@observer
export class LogRenderer extends React.Component<{ log: Log, applyConfig: (config: any) => void }> {
    @observable truncate: boolean = true

    @computed get configToShow() {
        const { truncate, prettyConfig } = this

        if (truncate) {
            return prettyConfig.substring(0, 200) + "...\n}"
        }
        return prettyConfig
    }

    @computed get prettyConfig() {
        const { log } = this.props
        return JSON.stringify(JSON.parse(log.config), undefined, 2)
    }

    @computed get title() {
        const { log } = this.props

        const user = log.userName || log.userId.toString()
        return "Invalidated " + timeago.format(log.createdAt) + " by " + user
    }

    @action.bound onExpand() {
        this.truncate = false
    }

    @action.bound onCollapse() {
        this.truncate = true
    }

    render() {
        const { configToShow, title, truncate } = this
        const { log } = this.props

        return <div>
            <Section name={title}>
                <pre>{configToShow}</pre>
                <button className="btn btn-danger" onClick={_ => this.props.applyConfig(log.config)}>Apply</button>
                <button className="btn btn-secondary" onClick={truncate ? this.onExpand : this.onCollapse}>{truncate ? "Expand" : "Collapse"}</button>
            </Section>
        </div>
    }
}

@observer
export default class EditorHistoryTab extends React.Component<{ editor: ChartEditor}> {
    @computed get logs() { return this.props.editor.logs || [] }

    @action.bound async applyConfig(config: any) {
        this.props.editor.applyConfig(config)
    }

    render() {
        return <div>
            {this.logs.length === 0 && <span>No history to show yet :(</span>}
            {this.logs.map(log => {
                return <LogRenderer log={log} applyConfig={this.applyConfig}></LogRenderer>
            })}
        </div>
    }
}