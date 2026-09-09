/**
 * Creating a narrative chart from a parent chart config: `GrapherEditor`
 * with the parent's full config as the base and an empty patch, opened in
 * the view state the user was looking at, plus a name to give the new
 * narrative chart.
 */
import * as React from "react"
import { Prompt, Redirect, useLocation } from "react-router-dom"
import { action, computed, makeObservable, observable, runInAction } from "mobx"
import { observer } from "mobx-react"
import {
    GrapherInterface,
    GrapherQueryParams,
    Url,
} from "@ourworldindata/utils"
import {
    isKebabCase,
    NARRATIVE_CHART_KEBAB_CASE_ERROR_MSG,
} from "../adminShared/validation.js"
import { Admin } from "./Admin.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { LoadingBlocker } from "./Forms.js"
import { GrapherEditor } from "./GrapherEditor.js"
import { ConfigEditor } from "./ConfigEditor.js"
import { NarrativeChartSaveButtons } from "./NarrativeChartSaveButtons.js"
import { NotFoundPage } from "./NotFoundPage.js"
import {
    adminDetailsProvider,
    adminEditorEnvironment,
    adminIndicatorCatalog,
    adminTopicSlugs,
} from "./adminEditorProviders.js"
import { dataApiIndicatorStore, IndicatorStore } from "./indicatorStores.js"
import { makeNarrativeChartPatchConfig } from "./narrativeChartConfig.js"

export function CreateNarrativeChartEditorPage() {
    const { search } = useLocation()
    const searchParams = new URLSearchParams(search)
    const type = searchParams.get("type")
    const chartConfigId = searchParams.get("chartConfigId")
    // The state the parent chart was in when the user hit "Create narrative
    // chart", serialized as a nested query string.
    const grapherQueryStr = searchParams.get("grapherQueryStr")

    if (type === "multiDim" && chartConfigId) {
        return (
            <CreateNarrativeChartEditorPageInternal
                type="multiDim"
                chartConfigId={chartConfigId}
                grapherQueryStr={grapherQueryStr}
            />
        )
    }
    return <NotFoundPage />
}

interface CreateNarrativeChartEditorPageInternalProps {
    type: "multiDim"
    chartConfigId: string
    grapherQueryStr: string | null
}

@observer
class CreateNarrativeChartEditorPageInternal extends React.Component<CreateNarrativeChartEditorPageInternalProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    constructor(props: CreateNarrativeChartEditorPageInternalProps) {
        super(props)
        makeObservable(this, {
            isLoaded: observable,
            parentConfig: observable.ref,
            name: observable,
            nameError: observable,
            createdId: observable.ref,
            isDirty: observable,
        })
    }

    isLoaded = false
    /** The parent chart config the narrative chart starts from. */
    parentConfig: GrapherInterface | undefined = undefined
    name: string | undefined = undefined
    nameError: string | undefined = undefined
    /** Set once the narrative chart exists, so the page can move to it. */
    createdId: number | undefined = undefined
    isDirty = false

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get store(): IndicatorStore {
        return dataApiIndicatorStore({
            dataApiUrl: adminEditorEnvironment.dataApiUrl,
            catalog: adminIndicatorCatalog(this.admin),
        })
    }

    @computed get initialQueryParams(): GrapherQueryParams | undefined {
        const { grapherQueryStr } = this.props
        if (!grapherQueryStr) return undefined
        return Url.fromQueryStr(grapherQueryStr).queryParams
    }

    async fetchParentConfig(): Promise<void> {
        const chartConfig = await this.admin.getJSON(
            `/api/chart-configs/${this.props.chartConfigId}.config.json`
        )
        runInAction(() => {
            this.parentConfig = chartConfig
            this.isLoaded = true
        })
    }

    override componentDidMount(): void {
        void this.fetchParentConfig()
    }

    @action.bound onNameChange(value: string) {
        this.name = value
        this.nameError = isKebabCase(value)
            ? undefined
            : NARRATIVE_CHART_KEBAB_CASE_ERROR_MSG
    }

    /** POSTs the new narrative chart and moves to its editor. */
    @action.bound async onSave(
        patch: GrapherInterface,
        editor: ConfigEditor
    ): Promise<void> {
        this.nameError = undefined
        const json = await this.admin.requestJSON(
            "/api/narrative-charts",
            {
                type: this.props.type,
                name: this.name,
                parentChartConfigId: this.props.chartConfigId,
                config: makeNarrativeChartPatchConfig(
                    editor.liveConfigWithDefaults,
                    editor.activeParentConfigWithDefaults
                ),
            },
            "POST"
        )
        if (json.success) {
            // Mark the editor saved in the same action that triggers the
            // redirect: `<Redirect>` navigates after React has re-rendered,
            // so the unsaved-changes prompt already sees a clean editor.
            // (A direct `history.push` here would run before that render
            // and fire the prompt on our own navigation.)
            runInAction(() => {
                editor.savedPatchConfig = editor.store.toEditorConfig(patch)
                this.createdId = json.narrativeChartId
            })
        } else {
            runInAction(() => (this.nameError = json.errorMsg))
            throw new Error(json.errorMsg ?? "Creating failed")
        }
    }

    override render(): React.ReactElement {
        return (
            <AdminLayout noSidebar>
                <Prompt
                    when={this.isDirty && !this.createdId}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />
                {this.createdId && (
                    <Redirect to={`/narrative-charts/${this.createdId}/edit`} />
                )}
                {this.isLoaded ? (
                    <GrapherEditor
                        config={{}}
                        baseConfig={this.parentConfig}
                        initialQueryParams={this.initialQueryParams}
                        store={this.store}
                        details={adminDetailsProvider(this.admin)}
                        topicSlugs={adminTopicSlugs(this.admin)}
                        environment={adminEditorEnvironment}
                        syncTabWithUrl
                        onDirtyChange={action(
                            (isDirty: boolean) => (this.isDirty = isDirty)
                        )}
                        renderSaveButtons={(editor, editingErrors) => (
                            <NarrativeChartSaveButtons
                                editor={editor}
                                editingErrors={editingErrors}
                                parentUrl={null}
                                create={{
                                    name: this.name,
                                    nameError: this.nameError,
                                    onNameChange: this.onNameChange,
                                }}
                            />
                        )}
                        onSave={this.onSave}
                    />
                ) : (
                    <main className="ChartEditorPage">
                        <LoadingBlocker isLoading />
                    </main>
                )}
            </AdminLayout>
        )
    }
}
