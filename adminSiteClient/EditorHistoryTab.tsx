import { Component } from "react"
import { observer } from "mobx-react"
import * as _ from "lodash-es"
import { GrapherInterface } from "@ourworldindata/types"
import { dayjs } from "@ourworldindata/utils"
import { Log, makeRestoredPatchConfig } from "./adminChartApi.js"
import { ConfigEditor } from "./ConfigEditor.js"
import { Timeago } from "./Forms.js"
import { action, computed, observable, makeObservable } from "mobx"
import {
    Alert,
    Button,
    Card,
    Empty,
    Flex,
    Modal,
    Timeline,
    Tooltip,
    Typography,
    notification,
    type TimelineItemProps,
} from "antd"
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued"
import { stringify } from "safe-stable-stringify"

const FIELDS_IGNORED_IN_SUMMARY = ["version", "$schema", "id"]
const MAX_FIELDS_IN_SUMMARY = 3

type OpenModal =
    | { kind: "compare" | "restore"; logIndex: number }
    | { kind: "compareUnsaved" }

interface EditorHistoryTabProps {
    logs: Log[]
    editor: ConfigEditor
    /** Load a patch into the editor without saving, over the base it inherits from */
    loadPatchConfig: (patchConfig: GrapherInterface) => Promise<void>
}

@observer
export class EditorHistoryTab extends Component<EditorHistoryTabProps> {
    openModal: OpenModal | undefined = undefined

    constructor(props: EditorHistoryTabProps) {
        super(props)
        makeObservable(this, { openModal: observable.ref })
    }

    @computed get logs(): Log[] {
        return this.props.logs
    }

    /** What changed in each save relative to the one before it */
    @computed get changeSummaries(): string[] {
        return this.logs.map((log, i) => {
            const previousLog = this.logs[i + 1]
            return previousLog
                ? summarizeChangedFields(log.config, previousLog.config)
                : "Oldest stored version"
        })
    }

    @action.bound closeModal(): void {
        this.openModal = undefined
    }

    @action.bound showModal(openModal: OpenModal): void {
        this.openModal = openModal
    }

    @action.bound async onRestore(log: Log): Promise<void> {
        this.closeModal()
        const { editor, loadPatchConfig } = this.props
        await loadPatchConfig(
            makeRestoredPatchConfig(log.config, editor.patchConfig)
        )
        notification.info({
            title: "Version loaded",
            description: (
                <>
                    Loaded the version {renderSavedBy(log)}. Nothing changes
                    until you save.
                </>
            ),
        })
    }

    @action.bound async onDiscardUnsavedChanges(): Promise<void> {
        this.closeModal()
        await this.props.loadPatchConfig(this.props.editor.savedPatchConfig)
        notification.info({ title: "Unsaved changes discarded" })
    }

    makeUnsavedChangesTimelineItem(): TimelineItemProps {
        const { editor } = this.props
        return {
            key: "unsaved",
            color: "orange",
            classNames: { rail: "EditorHistoryTab__timeline-rail--unsaved" },
            content: (
                <TimelineItemLayout
                    isUnsaved
                    actions={
                        <Button
                            size="small"
                            onClick={() =>
                                this.showModal({ kind: "compareUnsaved" })
                            }
                        >
                            Compare
                        </Button>
                    }
                >
                    <Typography.Text strong>Unsaved changes</Typography.Text>
                    <Typography.Text type="secondary">
                        {summarizeChangedFields(
                            editor.patchConfig,
                            editor.savedPatchConfig
                        )}
                    </Typography.Text>
                </TimelineItemLayout>
            ),
        }
    }

    makeSaveTimelineItem(log: Log, logIndex: number): TimelineItemProps {
        const previousLog = this.logs[logIndex + 1]
        const isLatest = logIndex === 0
        return {
            key: `${log.createdAt}-${logIndex}`,
            color: "blue",
            content: (
                <TimelineItemLayout
                    actions={
                        <>
                            <Button
                                size="small"
                                onClick={() =>
                                    this.showModal({
                                        kind: "compare",
                                        logIndex,
                                    })
                                }
                            >
                                {previousLog ? "Compare" : "View"}
                            </Button>
                            {!isLatest && (
                                <Button
                                    size="small"
                                    onClick={() =>
                                        this.showModal({
                                            kind: "restore",
                                            logIndex,
                                        })
                                    }
                                >
                                    Restore
                                </Button>
                            )}
                        </>
                    }
                >
                    <Flex gap={8} align="center" wrap>
                        <Typography.Text strong>
                            {formatUser(log)}
                        </Typography.Text>
                        <Tooltip
                            title={dayjs(log.createdAt).format(
                                "D MMM YYYY, HH:mm"
                            )}
                        >
                            <Typography.Text type="secondary">
                                {dayjs(log.createdAt).fromNow()}
                            </Typography.Text>
                        </Tooltip>
                    </Flex>
                    <Typography.Text type="secondary">
                        {this.changeSummaries[logIndex]}
                    </Typography.Text>
                </TimelineItemLayout>
            ),
        }
    }

    renderModal(): React.ReactElement | null {
        const { openModal } = this
        const { editor } = this.props
        if (!openModal) return null

        if (openModal.kind === "compareUnsaved") {
            return (
                <CompareModal
                    title="Unsaved changes"
                    oldValue={stringify(editor.savedPatchConfig, null, 2)}
                    newValue={stringify(editor.patchConfig, null, 2)}
                    onClose={this.closeModal}
                    onDiscard={this.onDiscardUnsavedChanges}
                />
            )
        }

        const log = this.logs[openModal.logIndex]
        if (!log) return null

        if (openModal.kind === "compare") {
            const previousLog = this.logs[openModal.logIndex + 1]
            return (
                <CompareModal
                    title={<>Changes {renderSavedBy(log)}</>}
                    oldValue={
                        previousLog
                            ? stringify(previousLog.config, null, 2)
                            : ""
                    }
                    newValue={stringify(log.config, null, 2)}
                    onClose={this.closeModal}
                />
            )
        }

        return (
            <RestoreModal
                log={log}
                laterSaveCount={openModal.logIndex}
                hasUnsavedChanges={editor.isModified}
                currentPatchJson={stringify(editor.patchConfig, null, 2)}
                restoredPatchJson={stringify(
                    makeRestoredPatchConfig(log.config, editor.patchConfig),
                    null,
                    2
                )}
                onRestore={() => this.onRestore(log)}
                onClose={this.closeModal}
            />
        )
    }

    override render() {
        const { logs } = this
        if (logs.length === 0 && !this.props.editor.isModified)
            return <Empty description="No saves yet" />

        const items = logs.map((log, i) => this.makeSaveTimelineItem(log, i))
        if (this.props.editor.isModified)
            items.unshift(this.makeUnsavedChangesTimelineItem())

        return (
            <div className="EditorHistoryTab">
                <Timeline
                    items={items}
                    classNames={{
                        itemIcon: "EditorHistoryTab__timeline-dot",
                        itemRail: "EditorHistoryTab__timeline-rail",
                    }}
                />
                {this.renderModal()}
            </div>
        )
    }
}

function TimelineItemLayout({
    isUnsaved = false,
    actions,
    children,
}: {
    isUnsaved?: boolean
    actions: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <Card
            size="small"
            style={isUnsaved ? { borderStyle: "dashed" } : undefined}
        >
            <Flex justify="space-between" align="center" gap={12}>
                <Flex vertical gap={2}>
                    {children}
                </Flex>
                <Flex gap={6} style={{ flexShrink: 0 }}>
                    {actions}
                </Flex>
            </Flex>
        </Card>
    )
}

function CompareModal({
    title,
    oldValue,
    newValue,
    onClose,
    onDiscard,
}: {
    title: React.ReactNode
    oldValue: string
    newValue: string
    onClose: () => void
    onDiscard?: () => void
}) {
    return (
        <Modal
            open
            centered
            width="80vw"
            title={title}
            onCancel={onClose}
            footer={
                <>
                    <Button onClick={onClose}>Close</Button>
                    {onDiscard && (
                        <Button type="primary" danger onClick={onDiscard}>
                            Discard unsaved changes
                        </Button>
                    )}
                </>
            }
        >
            <ConfigDiff
                oldValue={oldValue}
                newValue={newValue}
                leftTitle="Before"
                rightTitle="After"
            />
        </Modal>
    )
}

function RestoreModal({
    log,
    laterSaveCount,
    hasUnsavedChanges,
    currentPatchJson,
    restoredPatchJson,
    onRestore,
    onClose,
}: {
    log: Log
    laterSaveCount: number
    hasUnsavedChanges: boolean
    currentPatchJson: string
    restoredPatchJson: string
    onRestore: () => void
    onClose: () => void
}) {
    const isUnchanged = currentPatchJson === restoredPatchJson
    const discarded = [
        laterSaveCount === 1
            ? "the save made after this version"
            : `the ${laterSaveCount} saves made after this version`,
        ...(hasUnsavedChanges ? ["your unsaved changes"] : []),
    ].join(" and ")

    return (
        <Modal
            open
            centered
            width="80vw"
            title={<>Restore the version {renderSavedBy(log)}</>}
            onCancel={onClose}
            footer={
                <>
                    <Button onClick={onClose}>Close</Button>
                    {!isUnchanged && (
                        <Button type="primary" onClick={onRestore}>
                            Restore this version
                        </Button>
                    )}
                </>
            }
        >
            {isUnchanged ? (
                <Typography.Paragraph>
                    This version matches the chart as it is now.
                </Typography.Paragraph>
            ) : (
                <Flex vertical gap={12}>
                    <Alert
                        type="warning"
                        showIcon
                        title={`Restoring discards ${discarded}. Only the chart's own settings change. ETL and indicator configs, the slug and the publishing state stay as they are. You can review the result before saving.`}
                    />
                    <ConfigDiff
                        oldValue={currentPatchJson}
                        newValue={restoredPatchJson}
                        leftTitle="The chart now"
                        rightTitle="After restoring"
                    />
                </Flex>
            )}
        </Modal>
    )
}

function ConfigDiff({
    oldValue,
    newValue,
    leftTitle,
    rightTitle,
}: {
    oldValue: string
    newValue: string
    leftTitle: string
    rightTitle: string
}) {
    return (
        <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
            <ReactDiffViewer
                oldValue={oldValue}
                newValue={newValue}
                leftTitle={leftTitle}
                rightTitle={rightTitle}
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
    )
}

function formatUser(log: Log): string {
    return log.userName || log.userId.toString()
}

function renderSavedBy(log: Log): React.ReactElement {
    return (
        <>
            saved <Timeago time={log.createdAt} by={formatUser(log)} />
        </>
    )
}

function summarizeChangedFields(
    config: GrapherInterface,
    previousConfig: GrapherInterface
): string {
    const changedFields = _.union(
        Object.keys(config),
        Object.keys(previousConfig)
    ).filter(
        (field) =>
            !FIELDS_IGNORED_IN_SUMMARY.includes(field) &&
            !_.isEqual(
                config[field as keyof GrapherInterface],
                previousConfig[field as keyof GrapherInterface]
            )
    )
    if (changedFields.length === 0) return "No changes"
    if (changedFields.length <= MAX_FIELDS_IN_SUMMARY)
        return changedFields.join(", ")
    const hiddenCount = changedFields.length - MAX_FIELDS_IN_SUMMARY
    return `${changedFields.slice(0, MAX_FIELDS_IN_SUMMARY).join(", ")} and ${hiddenCount} more`
}
