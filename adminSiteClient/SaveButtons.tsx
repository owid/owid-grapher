import * as _ from "lodash-es"
import { Component } from "react"
import { ChartEditor, isChartEditorInstance } from "./ChartEditor.js"
import { action, computed, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { excludeUndefined, slugify } from "@ourworldindata/utils"
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
import { Alert, Button, Space } from "antd"

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

    @action.bound onDeleteChart() {
        void this.props.editor.deleteGrapher()
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
                <Space wrap>
                    <Button
                        color="green"
                        variant="solid"
                        onClick={this.onSaveChart}
                        disabled={isSavingDisabled}
                    >
                        {grapherState.isPublished
                            ? "Update chart"
                            : isNewGrapher
                              ? "Create draft"
                              : "Save draft"}
                    </Button>
                    {!isNewGrapher && (
                        <>
                            <Button
                                onClick={this.onSaveAsNew}
                                disabled={isSavingDisabled}
                            >
                                Save as new
                            </Button>
                            <Button
                                color="danger"
                                variant="solid"
                                onClick={this.onPublishToggle}
                                disabled={isSavingDisabled}
                            >
                                {grapherState.isPublished
                                    ? "Unpublish"
                                    : "Publish"}
                            </Button>
                            <Button
                                color="danger"
                                variant="solid"
                                onClick={this.onDeleteChart}
                            >
                                Delete
                            </Button>
                        </>
                    )}
                </Space>
                {!isNewGrapher && (
                    <div className="SaveButtons__secondary-row">
                        <Button
                            type="primary"
                            onClick={() => {
                                this.isNarrativeChartNameModalOpen = true
                                this.narrativeChartNameModalError = undefined
                            }}
                            disabled={isSavingDisabled}
                        >
                            Save as narrative chart
                        </Button>
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
                        <Alert
                            key={i}
                            className="SaveButtons__error"
                            type="error"
                            title={error}
                        />
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

    @action.bound async onCreateDataInsight() {
        const { editor } = this.props
        // Save the narrative chart first if there are unsaved changes
        if (editor.isModified) {
            const shouldSave = window.confirm(
                "You have unsaved changes to this narrative chart. The Data Insight will use the saved version. Do you want to save your changes now before creating the DI?"
            )
            if (!shouldSave) return
            await editor.saveGrapher()
        }
        this.isCreateDataInsightModalOpen = true
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
                <Space wrap>
                    {isNewGrapher ? (
                        <Button
                            color="green"
                            variant="solid"
                            onClick={this.onCreateChart}
                            disabled={isSavingDisabled}
                        >
                            Create narrative chart
                        </Button>
                    ) : (
                        <Button
                            color="green"
                            variant="solid"
                            onClick={this.onSaveChart}
                            disabled={isSavingDisabled}
                        >
                            Save narrative chart
                        </Button>
                    )}
                    {editor.parentUrl && (
                        <Button
                            href={`/admin${editor.parentUrl}`}
                            target="_blank"
                            rel="noopener"
                        >
                            Go to parent chart
                        </Button>
                    )}
                    {!editor.isNewGrapher && (
                        <Button
                            onClick={this.onCreateDataInsight}
                            disabled={isSavingDisabled}
                        >
                            Create DI
                        </Button>
                    )}
                </Space>
                {grapherState.isReady &&
                    editingErrors.map((error, i) => (
                        <Alert
                            key={i}
                            className="SaveButtons__error"
                            type="error"
                            title={error}
                        />
                    ))}
                {this.isCreateDataInsightModalOpen && (
                    <CreateDataInsightModal
                        description="Create a new data insight based on this narrative chart."
                        narrativeChart={{
                            name: editor.manager.name!,
                            configId: editor.manager.configId!,
                            title: grapherState.fullTitle,
                        }}
                        initialValues={{
                            title: grapherState.fullTitle,
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
