import { Component, useEffect, useMemo, useRef, useState } from "react"
import { ChartEditor, isChartEditorInstance } from "./ChartEditor.js"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { excludeUndefined, omit, slugify } from "@ourworldindata/utils"
import {
    IndicatorChartEditor,
    isIndicatorChartEditorInstance,
} from "./IndicatorChartEditor.js"
import {
    ErrorMessages,
    ErrorMessagesForDimensions,
} from "./ChartEditorTypes.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import {
    ChartViewEditor,
    chartViewsFeatureEnabled,
    isChartViewEditorInstance,
} from "./ChartViewEditor.js"
import { Form, Input, InputRef, Modal, Spin } from "antd"

@observer
export class SaveButtons<Editor extends AbstractChartEditor> extends Component<{
    editor: Editor
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    render() {
        const { editor } = this.props
        const passthroughProps = omit(this.props, "editor")
        if (isChartEditorInstance(editor))
            return <SaveButtonsForChart editor={editor} {...passthroughProps} />
        else if (isIndicatorChartEditorInstance(editor))
            return (
                <SaveButtonsForIndicatorChart
                    editor={editor}
                    {...passthroughProps}
                />
            )
        else if (isChartViewEditorInstance(editor))
            return (
                <SaveButtonsForChartView
                    editor={editor}
                    {...passthroughProps}
                />
            )
        else return null
    }
}

@observer
class SaveButtonsForChart extends Component<{
    editor: ChartEditor
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @action.bound onSaveAsNew() {
        void this.props.editor.saveAsNewGrapher()
    }

    @action.bound onPublishToggle() {
        if (this.props.editor.grapher.isPublished)
            this.props.editor.unpublishGrapher()
        else this.props.editor.publishGrapher()
    }

    @computed get editingErrors(): string[] {
        const { errorMessages, errorMessagesForDimensions } = this.props
        return excludeUndefined([
            ...Object.values(errorMessages),
            ...Object.values(errorMessagesForDimensions).flat(),
        ])
    }

    @computed get initialNarrativeChartName(): string {
        return slugify(this.props.editor.grapher.title ?? "")
    }

    @observable narrativeChartNameModalOpen:
        | "open"
        | "open-loading"
        | "closed" = "closed"
    @observable narrativeChartNameModalError: string | undefined = undefined

    @action.bound async onSubmitNarrativeChartButton(name: string) {
        const { editor } = this.props

        this.narrativeChartNameModalOpen = "open-loading"
        const res = await editor.saveAsChartView(name)
        if (res.success) {
            this.narrativeChartNameModalOpen = "closed"
        } else {
            this.narrativeChartNameModalOpen = "open"
            this.narrativeChartNameModalError = res.errorMsg
        }
    }

    render() {
        const { editingErrors } = this
        const { editor } = this.props
        const { grapher } = editor

        const hasEditingErrors = editingErrors.length > 0
        const isSavingDisabled = grapher.hasFatalErrors || hasEditingErrors

        return (
            <div className="SaveButtons">
                <div>
                    <button
                        className="btn btn-success"
                        onClick={this.onSaveChart}
                        disabled={isSavingDisabled}
                    >
                        {grapher.isPublished
                            ? "Update chart"
                            : grapher.id
                              ? "Save draft"
                              : "Create draft"}
                    </button>{" "}
                    <button
                        className="btn btn-secondary"
                        onClick={this.onSaveAsNew}
                        disabled={isSavingDisabled}
                    >
                        Save as new
                    </button>{" "}
                    <button
                        className="btn btn-danger"
                        onClick={this.onPublishToggle}
                        disabled={isSavingDisabled}
                    >
                        {grapher.isPublished ? "Unpublish" : "Publish"}
                    </button>
                </div>
                {chartViewsFeatureEnabled && (
                    <>
                        <div className="mt-2">
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    this.narrativeChartNameModalOpen = "open"
                                    this.narrativeChartNameModalError =
                                        undefined
                                }}
                                disabled={isSavingDisabled}
                            >
                                Save as narrative chart
                            </button>
                        </div>
                        <NarrativeChartNameModal
                            open={this.narrativeChartNameModalOpen}
                            initialName={this.initialNarrativeChartName}
                            errorMsg={this.narrativeChartNameModalError}
                            onSubmit={this.onSubmitNarrativeChartButton}
                            onCancel={() =>
                                (this.narrativeChartNameModalOpen = "closed")
                            }
                        />
                    </>
                )}
                {editingErrors.map((error, i) => (
                    <div key={i} className="alert alert-danger mt-2">
                        {error}
                    </div>
                ))}
            </div>
        )
    }
}

@observer
class SaveButtonsForIndicatorChart extends Component<{
    editor: IndicatorChartEditor
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @computed get editingErrors(): string[] {
        const { errorMessages, errorMessagesForDimensions } = this.props
        return excludeUndefined([
            ...Object.values(errorMessages),
            ...Object.values(errorMessagesForDimensions).flat(),
        ])
    }

    render() {
        const { editingErrors } = this
        const { editor } = this.props
        const { grapher } = editor

        const isTrivial = editor.isNewGrapher && !editor.isModified
        const hasEditingErrors = editingErrors.length > 0
        const isSavingDisabled =
            grapher.hasFatalErrors || hasEditingErrors || isTrivial

        return (
            <div className="SaveButtons">
                <button
                    className="btn btn-success"
                    onClick={this.onSaveChart}
                    disabled={isSavingDisabled}
                >
                    {editor.isNewGrapher
                        ? "Create indicator chart"
                        : "Update indicator chart"}
                </button>
                {editingErrors.map((error, i) => (
                    <div key={i} className="alert alert-danger mt-2">
                        {error}
                    </div>
                ))}
            </div>
        )
    }
}

@observer
class SaveButtonsForChartView extends Component<{
    editor: ChartViewEditor
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @computed get editingErrors(): string[] {
        const { errorMessages, errorMessagesForDimensions } = this.props
        return excludeUndefined([
            ...Object.values(errorMessages),
            ...Object.values(errorMessagesForDimensions).flat(),
        ])
    }

    render() {
        const { editingErrors } = this
        const { editor } = this.props
        const { grapher } = editor

        const hasEditingErrors = editingErrors.length > 0
        const isSavingDisabled = grapher.hasFatalErrors || hasEditingErrors

        return (
            <div className="SaveButtons">
                <button
                    className="btn btn-success"
                    onClick={this.onSaveChart}
                    disabled={isSavingDisabled}
                >
                    Save chart view
                </button>{" "}
                <a
                    className="btn btn-secondary"
                    href={`/admin/charts/${editor.parentChartId}/edit`}
                    target="_blank"
                    rel="noopener"
                >
                    Go to parent chart
                </a>
                {editingErrors.map((error, i) => (
                    <div key={i} className="alert alert-danger mt-2">
                        {error}
                    </div>
                ))}
            </div>
        )
    }
}

const NarrativeChartNameModal = (props: {
    initialName: string
    open: "open" | "open-loading" | "closed"
    errorMsg?: string
    onSubmit: (name: string) => void
    onCancel?: () => void
}) => {
    const [name, setName] = useState<string>(props.initialName)
    const inputField = useRef<InputRef>(null)
    const isLoading = useMemo(() => props.open === "open-loading", [props.open])
    const isOpen = useMemo(() => props.open !== "closed", [props.open])

    useEffect(() => setName(props.initialName), [props.initialName])

    useEffect(() => {
        if (isOpen) {
            inputField.current?.focus({ cursor: "all" })
        }
    }, [isOpen])

    return (
        <Modal
            title="Save as narrative chart"
            open={isOpen}
            onOk={() => props.onSubmit(name)}
            onCancel={props.onCancel}
            onClose={props.onCancel}
            okButtonProps={{ disabled: !name || isLoading }}
            cancelButtonProps={{ disabled: isLoading }}
        >
            <div>
                <p>
                    This will create a new narrative chart that is linked to
                    this chart. Any currently pending changes will be applied to
                    the narrative chart.
                </p>
                <p>
                    Please enter a programmatic name for the narrative chart.{" "}
                    <i>Note that this name cannot be changed later.</i>
                </p>
                <Form.Item label="Name">
                    <Input
                        ref={inputField}
                        onChange={(e) => setName(e.target.value)}
                        value={name}
                        disabled={isLoading}
                    />
                </Form.Item>
                {isLoading && <Spin />}
                {props.errorMsg && (
                    <div
                        className="alert alert-danger"
                        style={{ whiteSpace: "pre-wrap" }}
                    >
                        {props.errorMsg}
                    </div>
                )}
            </div>
        </Modal>
    )
}
