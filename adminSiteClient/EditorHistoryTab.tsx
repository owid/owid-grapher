import React from "react"
import { observer } from "mobx-react"
import { ChartEditor, Log } from "./ChartEditor.js"
import { Timeago } from "./Forms.js"
import { computed, action, observable } from "mobx"
import { Json } from "@ourworldindata/utils"
import { Modal } from "antd"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued"

function LogCompareModal({
    log,
    previousLog,
    isOpen,
    onClose,
}: {
    log: Log
    previousLog: Log
    isOpen: boolean
    onClose: () => void
}) {
    const titleForLog = (log: Log) => {
        const user = log.userName || log.userId.toString()
        return <Timeago time={log.createdAt} by={user} />
    }

    return (
        <Modal
            open={isOpen}
            centered
            width="80vw"
            onOk={onClose}
            onCancel={onClose}
            cancelButtonProps={{ style: { display: "none" } }}
        >
            <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
                <ReactDiffViewer
                    newValue={JSON.stringify(log.config, null, 2)}
                    oldValue={JSON.stringify(previousLog.config, null, 2)}
                    leftTitle={titleForLog(previousLog)}
                    rightTitle={titleForLog(log)}
                    compareMethod={DiffMethod.WORDS_WITH_SPACE}
                    styles={{
                        contentText: {
                            wordBreak: "break-word",
                        },
                    }}
                    extraLinesSurroundingDiff={2}
                />
            </div>
        </Modal>
    )
}

@observer
class LogRenderer extends React.Component<{
    log: Log
    previousLog: Log | undefined
    applyConfig: (config: any) => void
}> {
    @observable isCompareModalOpen = false

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
        const hasCompareButton = !!this.props.previousLog

        return (
            <li
                className="list-group-item d-flex justify-content-between"
                style={{ alignItems: "center" }}
            >
                {hasCompareButton && (
                    <LogCompareModal
                        log={log}
                        previousLog={this.props.previousLog}
                        isOpen={this.isCompareModalOpen}
                        onClose={() => (this.isCompareModalOpen = false)}
                    />
                )}
                <span>{title}</span>
                <div className="d-flex" style={{ gap: 6 }}>
                    {hasCompareButton && (
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

    @action.bound async applyConfig(config: Json) {
        const { grapher } = this.props.editor
        grapher.updateFromObject(config)
        grapher.updateAuthoredVersion({
            ...grapher.toObject(),
            data: config.data,
        })
        grapher.rebuildInputOwidTable()
    }

    render() {
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
            </div>
        )
    }
}
