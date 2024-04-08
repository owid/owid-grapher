import React from "react"
import { observer } from "mobx-react"
import { ChartEditor, Log } from "./ChartEditor.js"
import { Section, Timeago } from "./Forms.js"
import { computed, action, observable } from "mobx"
import { copyToClipboard } from "@ourworldindata/utils"
import { dump } from "js-yaml"
import { notification, Modal } from "antd"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer"

@observer
class LogRenderer extends React.Component<{
    log: Log
    previousLog: Log | undefined
    applyConfig: (config: any) => void
}> {
    @observable isCompareModalOpen = false

    titleForLog(log: Log) {
        const user = log.userName || log.userId.toString()
        return (
            <>
                Saved <Timeago time={log.createdAt} by={user} />
            </>
        )
    }

    @computed get title() {
        return this.titleForLog(this.props.log)
    }

    @computed get compareModal() {
        const { log, previousLog } = this.props

        return (
            <Modal
                open={this.isCompareModalOpen}
                centered
                width="80vw"
                onOk={() => (this.isCompareModalOpen = false)}
                onCancel={() => (this.isCompareModalOpen = false)}
                cancelButtonProps={{ style: { display: "none" } }}
            >
                <div style={{ overflowY: "auto", maxHeight: "50vh" }}>
                    <ReactDiffViewer
                        newValue={JSON.stringify(log.config, null, 2)}
                        oldValue={JSON.stringify(previousLog?.config, null, 2)}
                        leftTitle={
                            previousLog ? this.titleForLog(previousLog) : ""
                        }
                        rightTitle={this.title}
                        compareMethod={DiffMethod.WORDS}
                        styles={{
                            contentText: {
                                wordBreak: "break-word",
                            },
                        }}
                    />
                </div>
            </Modal>
        )
    }

    render() {
        const { log } = this.props
        const { title } = this

        return (
            <li
                className="list-group-item d-flex justify-content-between"
                style={{ alignItems: "center" }}
            >
                {this.compareModal}
                <span>{title}</span>
                <div className="d-flex" style={{ gap: 6 }}>
                    {!!this.props.previousLog && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => (this.isCompareModalOpen = true)}
                        >
                            Compare <br /> to previous
                        </button>
                    )}
                    <button
                        className="btn btn-danger"
                        onClick={() => this.props.applyConfig(log.config)}
                    >
                        Restore
                    </button>
                </div>
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
                            previousLog={this.logs[i + 1]} // Needed for comparison, might be undefined
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
