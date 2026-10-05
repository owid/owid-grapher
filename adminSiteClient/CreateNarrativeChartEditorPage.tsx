import * as React from "react"
import { Redirect, useLocation } from "react-router-dom"
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
    adminIndicatorCatalog,
    defaultEditorEnvironment,
} from "./editorProviders.js"
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
        })
    }

    isLoaded = false
    parentConfig: GrapherInterface | undefined = undefined
    name: string | undefined = undefined
    nameError: string | undefined = undefined
    createdId: number | undefined = undefined

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get store(): IndicatorStore {
        return dataApiIndicatorStore({
            dataApiUrl: defaultEditorEnvironment.dataApiUrl,
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
                    editor.baseConfigWithDefaults
                ),
            },
            "POST"
        )
        if (json.success) {
            runInAction(() => {
                editor.markAsSaved(patch)
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
                {this.createdId && (
                    <Redirect to={`/narrative-charts/${this.createdId}/edit`} />
                )}
                {this.isLoaded ? (
                    <GrapherEditor
                        config={{}}
                        baseConfig={this.parentConfig}
                        previewUrl={
                            this.parentConfig?.id
                                ? `/admin/charts/${this.parentConfig.id}/preview`
                                : undefined
                        }
                        initialQueryParams={this.initialQueryParams}
                        store={this.store}
                        details={adminDetailsProvider(this.admin)}
                        renderSaveButtons={(editor, editingErrors) => (
                            <NarrativeChartSaveButtons
                                editor={editor}
                                editingErrors={editingErrors}
                                parentUrl={null}
                                chart={{
                                    status: "new",
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
