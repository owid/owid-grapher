import { Component } from "react"
import { action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ConfigEditor } from "./ConfigEditor.js"
import { TextField } from "./Forms.js"
import { CreateDataInsightModal } from "./CreateDataInsightModal.js"

interface NarrativeChartSaveButtonsProps {
    editor: ConfigEditor
    editingErrors: string[]
    parentUrl: string | null
    chart: NewNarrativeChart | SavedNarrativeChart
}

interface NewNarrativeChart {
    status: "new"
    name: string | undefined
    nameError: string | undefined
    onNameChange: (value: string) => void
}

interface SavedNarrativeChart {
    status: "saved"
    name: string
    configId: string
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
        if (editor.isModified) {
            const shouldSave = window.confirm(
                "You have unsaved changes to this narrative chart. The Data Insight will use the saved version. Do you want to save your changes now before creating the DI?"
            )
            if (!shouldSave) return
            let saveFailed = false
            await editor.saveGrapher({ onError: () => (saveFailed = true) })
            if (saveFailed) return
        }
        this.isCreateDataInsightModalOpen = true
    }

    override render() {
        const { editor, editingErrors, parentUrl, chart } = this.props
        const { grapherState } = editor

        const isSavingDisabled =
            grapherState.hasFatalErrors || editingErrors.length > 0

        return (
            <div className="SaveButtons">
                {chart.status === "new" && (
                    <div className="mb-3">
                        <p>
                            Please enter a programmatic name for the narrative
                            chart.{" "}
                            <i>Note that this name cannot be changed later.</i>
                        </p>
                        <TextField
                            label="Name"
                            value={chart.name}
                            onValue={chart.onNameChange}
                            errorMessage={chart.nameError}
                            required
                        />
                    </div>
                )}
                <button
                    className="btn btn-success"
                    onClick={this.onSave}
                    disabled={isSavingDisabled}
                >
                    {chart.status === "new"
                        ? "Create narrative chart"
                        : "Save narrative chart"}
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
                {chart.status === "saved" && (
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
                {chart.status === "saved" &&
                    this.isCreateDataInsightModalOpen && (
                        <CreateDataInsightModal
                            description="Create a new data insight based on this narrative chart."
                            narrativeChart={{
                                name: chart.name,
                                configId: chart.configId,
                                title: grapherState.fullTitle,
                            }}
                            initialValues={{
                                title: grapherState.fullTitle,
                                imageFilename: `${chart.name}.png`,
                            }}
                            hiddenFields={["grapherUrl", "narrativeChart"]}
                            closeModal={action(
                                () =>
                                    (this.isCreateDataInsightModalOpen = false)
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
