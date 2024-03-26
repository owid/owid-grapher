import React from "react"
import { observer } from "mobx-react"
import { ChartEditor, Log } from "./ChartEditor.js"
import { Section, Timeago } from "./Forms.js"
import { computed, action } from "mobx"
import { copyToClipboard } from "@ourworldindata/utils"
import { dump } from "js-yaml"
import { notification } from "antd"

@observer
class LogRenderer extends React.Component<{
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
        return (
            <>
                Saved <Timeago time={log.createdAt} by={user} />
            </>
        )
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
        const { grapher } = this.props.editor
        const configJson = JSON.parse(config)
        grapher.updateFromObject(configJson)
        grapher.updateAuthoredVersion({
            ...grapher.toObject(),
            data: configJson.data,
        })
        grapher.rebuildInputOwidTable()
    }

    @action.bound copyYamlToClipboard() {
        // Use the Clipboard API to copy the config into the users clipboard
        const chartConfigObject = {
            ...this.props.editor.grapher.object,
        }
        delete chartConfigObject.id
        delete chartConfigObject.dimensions
        delete chartConfigObject.version
        delete chartConfigObject.isPublished
        const chartConfigAsYaml = dump(chartConfigObject)
        void copyToClipboard(chartConfigAsYaml)
        notification["success"]({
            message: "Copied YAML to clipboard",
            description: "You can now paste this into the ETL",
            placement: "bottomRight",
            closeIcon: <></>,
        })
    }

    render() {
        // Avoid modifying the original JSON object
        // Due to mobx memoizing computed values, the JSON can be mutated.
        const chartConfigObject = {
            ...this.props.editor.grapher.object,
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
                    <button
                        className="btn btn-primary"
                        onClick={this.copyYamlToClipboard}
                    >
                        Copy YAML for ETL
                    </button>
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
