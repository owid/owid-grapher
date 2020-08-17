import * as React from "react"
import { observer } from "mobx-react"
import { ChartEditor, Log } from "./ChartEditor"
import { Section } from "./Forms"
import { computed, action } from "mobx"
import { format } from "timeago.js"

@observer
export class LogRenderer extends React.Component<{
    log: Log
    applyConfig: (config: any) => void
}> {
    @computed get prettyConfig() {
        const { log } = this.props
        return JSON.stringify(JSON.parse(log.config), undefined, 2)
    }

    @computed get title() {
        const { log } = this.props

        const user = log.userName || log.userId.toString()
        return `Saved ${format(log.createdAt)} by ${user}`
    }

    @computed get timestamp() {
        return format(this.props.log.createdAt)
    }

    render() {
        const { log } = this.props
        const { title } = this

        return (
            <li className="list-group-item d-flex justify-content-between">
                <span>{title}</span>
                <button
                    className="align-self-end btn btn-danger"
                    onClick={() => this.props.applyConfig(log.config)}
                >
                    Restore
                </button>
            </li>
        )
    }
}

@observer
export class EditorHistoryTab extends React.Component<{ editor: ChartEditor }> {
    @computed get logs() {
        return this.props.editor.logs || []
    }

    @action.bound async applyConfig(config: any) {
        this.props.editor.applyConfig(config)
    }

    render() {
        // Avoid modifying the original JSON object
        // Due to mobx memoizing computed values, the JSON can be mutated.
        const chartConfigObject = {
            ...this.props.editor.currentChartJson,
            externalDataUrl: this.props.editor.chart.dataUrl
        }
        return (
            <div>
                {this.logs.map((log, i) => (
                    <ul key={i} className="list-group">
                        <LogRenderer
                            log={log}
                            applyConfig={this.applyConfig}
                        ></LogRenderer>
                    </ul>
                ))}
                <Section name="Debug Version">
                    <textarea
                        rows={7}
                        readOnly
                        className="form-control"
                        value={JSON.stringify(chartConfigObject, undefined, 2)}
                    />
                </Section>
            </div>
        )
    }
}
