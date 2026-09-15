/**
 * The admin's save actions for a narrative chart: create (with its
 * programmatic name) or save, jump to the parent chart, create a data
 * insight. Plugged into `GrapherEditor` through `renderSaveButtons`; the
 * requests themselves live on the page that owns the narrative chart.
 */
import { Component } from "react"
import { action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ConfigEditor } from "./ConfigEditor.js"
import { TextField } from "./Forms.js"
import { CreateDataInsightModal } from "./CreateDataInsightModal.js"

interface NarrativeChartSaveButtonsProps {
    editor: ConfigEditor
    editingErrors: string[]
    /** Link to the parent chart's editor, if known. */
    parentUrl: string | null
    /**
     * For a narrative chart being created: the name field. Absent for an
     * existing narrative chart, whose name can't change.
     */
    create?: {
        name: string | undefined
        nameError: string | undefined
        onNameChange: (value: string) => void
    }
    /** For an existing narrative chart: what a data insight needs to know. */
    existing?: {
        name: string
        configId: string
    }
}

@observer
export class NarrativeChartSaveButtons extends Component<NarrativeChartSaveButtonsProps> {
    isCreateDataInsightModalOpen = false

    constructor(props: NarrativeChartSaveButtonsProps) {
        super(props)
        makeObservable(this, {
            isCreateDataInsightModalOpen: observable,
        })
    }

    @action.bound onSave() {
        void this.props.editor.saveGrapher()
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

    override render() {
        const { editor, editingErrors, parentUrl, create, existing } =
            this.props
        const { grapherState } = editor

        const isSavingDisabled =
            grapherState.hasFatalErrors || editingErrors.length > 0

        return (
            <div className="SaveButtons">
                {create && (
                    <div className="mb-3">
                        <p>
                            Please enter a programmatic name for the narrative
                            chart.{" "}
                            <i>Note that this name cannot be changed later.</i>
                        </p>
                        <TextField
                            label="Name"
                            value={create.name}
                            onValue={create.onNameChange}
                            errorMessage={create.nameError}
                            required
                        />
                    </div>
                )}
                <button
                    className="btn btn-success"
                    onClick={this.onSave}
                    disabled={isSavingDisabled}
                >
                    {create ? "Create narrative chart" : "Save narrative chart"}
                </button>{" "}
                {parentUrl && (
                    <>
                        <a
                            className="btn btn-secondary"
                            href={`/admin${parentUrl}`}
                            target="_blank"
                            rel="noopener"
                        >
                            Go to parent chart
                        </a>{" "}
                    </>
                )}
                {existing && (
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            void this.onCreateDataInsight()
                        }}
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
                {existing && this.isCreateDataInsightModalOpen && (
                    <CreateDataInsightModal
                        description="Create a new data insight based on this narrative chart."
                        narrativeChart={{
                            name: existing.name,
                            configId: existing.configId,
                            title: grapherState.fullTitle,
                        }}
                        initialValues={{
                            title: grapherState.fullTitle,
                            imageFilename: `${existing.name}.png`,
                        }}
                        hiddenFields={["grapherUrl", "narrativeChart"]}
                        closeModal={action(
                            () => (this.isCreateDataInsightModalOpen = false)
                        )}
                        onFinish={(response) => {
                            if (response.success) {
                                runInActionClose(this)
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

const runInActionClose = action(
    (component: NarrativeChartSaveButtons) =>
        (component.isCreateDataInsightModalOpen = false)
)
