import { Component } from "react"
import { observer } from "mobx-react"
import { Log } from "./adminChartApi.js"
import { Timeago } from "./Forms.js"
import { computed, observable, makeObservable } from "mobx"
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
                    highlightLanguage="json"
                />
            </div>
        </Modal>
    )
}

interface LogRendererProps {
    log: Log
    previousLog: Log | undefined
}

@observer
class LogRenderer extends Component<LogRendererProps> {
    isCompareModalOpen = false

    constructor(props: LogRendererProps) {
        super(props)

        makeObservable(this, {
            isCompareModalOpen: observable,
        })
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

    override render() {
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
                </div>
            </li>
        )
    }
}

/** The revision history of a chart in the admin database. */
export function EditorHistoryTab({ logs }: { logs: Log[] }) {
    if (logs.length === 0)
        return (
            <p className="text-muted p-3">
                No revisions yet. Every save of the chart adds one here.
            </p>
        )
    return (
        <div>
            {logs.map((log, i) => (
                <ul key={i} className="list-group">
                    <LogRenderer
                        log={log}
                        previousLog={logs[i + 1]} // Needed for comparison, might be undefined
                    ></LogRenderer>
                </ul>
            ))}
        </div>
    )
}
