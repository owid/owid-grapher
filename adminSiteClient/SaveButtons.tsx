import * as _ from "lodash-es"
import { Component } from "react"
import { ChartEditor, isChartEditorInstance } from "./ChartEditor.js"
import { action, computed, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { excludeUndefined, slugify } from "@ourworldindata/utils"
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
    NarrativeChartEditor,
    isNarrativeChartEditorInstance,
} from "./NarrativeChartEditor.js"
import { NarrativeChartNameModal } from "./NarrativeChartNameModal.js"
import { CreateDataInsightModal } from "./CreateDataInsightModal.js"

interface SaveButtonsProps<Editor extends AbstractChartEditor> {
    editor: Editor
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
}

@observer
export class SaveButtons<Editor extends AbstractChartEditor> extends Component<
    SaveButtonsProps<Editor>
> {
    override render() {
        const { editor } = this.props
        const passthroughProps = _.omit(this.props, "editor")
        if (isChartEditorInstance(editor))
            return <SaveButtonsForChart editor={editor} {...passthroughProps} />
        else if (isIndicatorChartEditorInstance(editor))
            return (
                <SaveButtonsForIndicatorChart
                    editor={editor}
                    {...passthroughProps}
                />
            )
        else if (isNarrativeChartEditorInstance(editor))
            return (
                <SaveButtonsForNarrativeChart
                    editor={editor}
                    {...passthroughProps}
                />
            )
        else return null
    }
}

@observer
class SaveButtonsForChart extends Component<SaveButtonsProps<ChartEditor>> {
    constructor(props: SaveButtonsProps<ChartEditor>) {
        super(props)

        makeObservable(this, {
            isNarrativeChartNameModalOpen: observable,
            narrativeChartNameModalError: observable,
        })
    }

    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @action.bound onSaveAsNew() {
        void this.props.editor.saveAsNewGrapher()
    }

    @action.bound onPublishToggle() {
        if (this.props.editor.grapherState.isPublished)
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
        return slugify(this.props.editor.grapherState.title ?? "")
    }

    isNarrativeChartNameModalOpen = false
    narrativeChartNameModalError: string | undefined = undefined

    @action.bound async onSubmitNarrativeChartButton(name: string) {
        const { editor } = this.props

        const res = await editor.saveAsNarrativeChart(name)
        if (res.success) {
            this.isNarrativeChartNameModalOpen = false
        } else {
            this.narrativeChartNameModalError = res.errorMsg
        }
    }

    override render() {
        const { editingErrors } = this
        const { editor } = this.props
        const { grapherState, isNewGrapher } = editor

        const hasEditingErrors = editingErrors.length > 0
        const isSavingDisabled = grapherState.hasFatalErrors || hasEditingErrors

        return (
            <div className="SaveButtons">
                <div>
                    <button
                        className="btn btn-success"
                        onClick={this.onSaveChart}
                        disabled={isSavingDisabled}
                    >
                        {grapherState.isPublished
                            ? "Update chart"
                            : isNewGrapher
                              ? "Create draft"
                              : "Save draft"}
                    </button>{" "}
                    {!isNewGrapher && (
                        <>
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
                                {grapherState.isPublished
                                    ? "Unpublish"
                                    : "Publish"}
                            </button>
                        </>
                    )}
                </div>
                {!isNewGrapher && (
                    <div className="mt-2">
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                this.isNarrativeChartNameModalOpen = true
                                this.narrativeChartNameModalError = undefined
                            }}
                            disabled={isSavingDisabled}
                        >
                            Save as narrative chart
                        </button>
                    </div>
                )}
                <NarrativeChartNameModal
                    isOpen={this.isNarrativeChartNameModalOpen}
                    initialName={this.initialNarrativeChartName}
                    errorMsg={this.narrativeChartNameModalError}
                    onSubmit={this.onSubmitNarrativeChartButton}
                    onCancel={() =>
                        (this.isNarrativeChartNameModalOpen = false)
                    }
                />
                {grapherState.isReady &&
                    editingErrors.map((error, i) => (
                        <div key={i} className="alert alert-danger mt-2">
                            {error}
                        </div>
                    ))}
            </div>
        )
    }
}

@observer
class SaveButtonsForIndicatorChart extends Component<
    SaveButtonsProps<IndicatorChartEditor>
> {
    constructor(props: SaveButtonsProps<IndicatorChartEditor>) {
        super(props)
        makeObservable(this)
    }

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

    override render() {
        const { editingErrors } = this
        const { editor } = this.props
        const { grapherState } = editor

        const isTrivial = editor.isNewGrapher && !editor.isModified
        const hasEditingErrors = editingErrors.length > 0
        const isSavingDisabled =
            grapherState.hasFatalErrors || hasEditingErrors || isTrivial

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
                {grapherState.isReady &&
                    editingErrors.map((error, i) => (
                        <div key={i} className="alert alert-danger mt-2">
                            {error}
                        </div>
                    ))}
            </div>
        )
    }
}

@observer
class SaveButtonsForNarrativeChart extends Component<
    SaveButtonsProps<NarrativeChartEditor>
> {
    isCreateDataInsightModalOpen = false

    constructor(props: SaveButtonsProps<NarrativeChartEditor>) {
        super(props)

        makeObservable(this, {
            isCreateDataInsightModalOpen: observable,
        })
    }

    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @action.bound onCreateChart() {
        void this.props.editor.createGrapher()
    }

    @computed get editingErrors(): string[] {
        const { errorMessages, errorMessagesForDimensions } = this.props
        return excludeUndefined([
            ...Object.values(errorMessages),
            ...Object.values(errorMessagesForDimensions).flat(),
        ])
    }

    override render() {
        const { editingErrors } = this
        const { editor } = this.props
        const { grapherState, isNewGrapher } = editor

        const hasEditingErrors = editingErrors.length > 0
        const isSavingDisabled = grapherState.hasFatalErrors || hasEditingErrors

        return (
            <div className="SaveButtons">
                {isNewGrapher ? (
                    <button
                        className="btn btn-success"
                        onClick={this.onCreateChart}
                        disabled={isSavingDisabled}
                    >
                        Create narrative chart
                    </button>
                ) : (
                    <button
                        className="btn btn-success"
                        onClick={this.onSaveChart}
                        disabled={isSavingDisabled}
                    >
                        Save narrative chart
                    </button>
                )}{" "}
                {editor.parentUrl && (
                    <>
                        <a
                            className="btn btn-secondary"
                            href={`/admin${editor.parentUrl}`}
                            target="_blank"
                            rel="noopener"
                        >
                            Go to parent chart
                        </a>{" "}
                    </>
                )}
                {!editor.isNewGrapher && (
                    <button
                        className="btn btn-secondary"
                        onClick={() =>
                            (this.isCreateDataInsightModalOpen = true)
                        }
                        disabled={isSavingDisabled}
                    >
                        Create DI
                    </button>
                )}
                {grapherState.isReady &&
                    editingErrors.map((error, i) => (
                        <div key={i} className="alert alert-danger mt-2">
                            {error}
                        </div>
                    ))}
                {this.isCreateDataInsightModalOpen && (
                    <CreateDataInsightModal
                        description="Create a new data insight based on this narrative chart."
                        narrativeChart={{
                            name: editor.manager.name!,
                            configId: editor.manager.configId!,
                            title: grapherState.currentTitle,
                        }}
                        initialValues={{
                            title: grapherState.currentTitle,
                            imageFilename: editor.manager.name
                                ? `${editor.manager.name}.png`
                                : undefined,
                        }}
                        hiddenFields={["grapherUrl", "narrativeChart"]}
                        closeModal={() =>
                            (this.isCreateDataInsightModalOpen = false)
                        }
                        onFinish={(response) => {
                            if (response.success) {
                                this.isCreateDataInsightModalOpen = false
                                window.open(
                                    `/admin/gdocs/${response.gdocId}/preview`,
                                    "_blank"
                                )
                            }
                        }}
                    />
                )}
            </div>
        )
    }
}
