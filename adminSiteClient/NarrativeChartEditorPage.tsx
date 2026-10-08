import React from "react"
import { observer } from "mobx-react"
import { computed, action, runInAction, observable, makeObservable } from "mobx"
import type { History } from "history"
import {
    GrapherInterface,
    OwidChartDimensionInterface,
} from "@ourworldindata/types"
import { CodeSnippet } from "@ourworldindata/components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faFile } from "@fortawesome/free-solid-svg-icons"
import { Admin } from "./Admin.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { LoadingBlocker, Section } from "./Forms.js"
import { GrapherEditor } from "./GrapherEditor.js"
import {
    ConfigEditor,
    EditorExtraTab,
    OriginUrlSuggestion,
} from "./ConfigEditor.js"
import { EditorReferencesTabForNarrativeChart } from "./EditorReferencesTab.js"
import { NarrativeChartSaveButtons } from "./NarrativeChartSaveButtons.js"
import { getFullReferencesCount, References } from "./adminChartApi.js"
import {
    adminDetailsProvider,
    adminIndicatorCatalog,
    adminOriginUrlSuggestions,
    adminScatterDefaults,
    defaultEditorEnvironment,
    DetailsProvider,
} from "./editorProviders.js"
import { dataApiIndicatorStore, IndicatorStore } from "./indicatorStores.js"
import { makeNarrativeChartPatchConfig } from "./narrativeChartConfig.js"

interface NarrativeChartEditorPageProps {
    narrativeChartId: number
    history: History
}

export function NarrativeChartInfo({ name }: { name: string }) {
    const gdocSnippet = `{.narrative-chart}
  name: ${name}
{}`
    return (
        <Section name="Narrative chart">
            <p>
                You are editing the config of a narrative chart named{" "}
                <i>{name}</i>.
            </p>
            <h6>
                <FontAwesomeIcon icon={faFile} /> GDoc ArchieML snippet
            </h6>
            <CodeSnippet code={gdocSnippet} forceShowCopyButton />
        </Section>
    )
}

@observer
export class NarrativeChartEditorPage extends React.Component<NarrativeChartEditorPageProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    isLoaded = false

    parentConfig: GrapherInterface | undefined = undefined
    patchConfig: GrapherInterface = {}

    name = ""
    configId = ""
    parentUrl: string | null = null

    references: References | undefined = undefined
    topicSlugs: string[] = []

    constructor(props: NarrativeChartEditorPageProps) {
        super(props)
        makeObservable(this, {
            isLoaded: observable,
            parentConfig: observable.ref,
            patchConfig: observable.ref,
            name: observable.ref,
            configId: observable.ref,
            parentUrl: observable.ref,
            references: observable,
            topicSlugs: observable.ref,
        })
    }

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get store(): IndicatorStore {
        return dataApiIndicatorStore({
            dataApiUrl: defaultEditorEnvironment.dataApiUrl,
            catalog: adminIndicatorCatalog(this.admin),
        })
    }

    @computed get details(): DetailsProvider {
        return adminDetailsProvider(this.admin)
    }

    @computed get previewUrl(): string | undefined {
        const parentId = this.parentConfig?.id
        return parentId ? `/admin/charts/${parentId}/preview` : undefined
    }

    @computed get scatterDefaults(): OwidChartDimensionInterface[] {
        return adminScatterDefaults()
    }

    @computed get originUrlSuggestions(): OriginUrlSuggestion[] {
        return adminOriginUrlSuggestions(this.references, this.topicSlugs)
    }

    async fetchNarrativeChartData(): Promise<void> {
        const data = await this.admin.getJSON(
            `/api/narrative-charts/${this.props.narrativeChartId}.config.json`
        )
        runInAction(() => {
            this.name = data.name
            this.configId = data.chartConfigId
            this.patchConfig = data.configPatch
            this.parentConfig = data.parentConfigFull
            this.parentUrl = data.parentUrl
            this.isLoaded = true
        })
    }

    async fetchRefs(): Promise<void> {
        const json = await this.admin.getJSON(
            `/api/narrative-charts/${this.props.narrativeChartId}.references.json`
        )
        runInAction(() => (this.references = json.references))
    }

    async fetchTopicSlugs(): Promise<void> {
        const json = await this.admin
            .requestJSON<{ slugs: string[] }>(
                "/api/gdocs/publishedTopicSlugs",
                {},
                "GET",
                { onFailure: "continue", isBackground: true }
            )
            .catch(() => undefined)
        if (json) runInAction(() => (this.topicSlugs = json.slugs))
    }

    override componentDidMount(): void {
        void this.fetchNarrativeChartData()
        void this.fetchRefs()
        void this.fetchTopicSlugs()
    }

    @action.bound async onSave(
        patch: GrapherInterface,
        editor: ConfigEditor
    ): Promise<GrapherInterface> {
        const json = await this.admin.requestJSON(
            `/api/narrative-charts/${this.props.narrativeChartId}`,
            {
                config: makeNarrativeChartPatchConfig(
                    editor.liveConfigWithDefaults,
                    editor.baseConfigWithDefaults
                ),
            },
            "PUT"
        )
        if (!json.success) throw new Error(json.errorMsg ?? "Saving failed")
        return patch
    }

    @computed get extraTabs(): EditorExtraTab[] {
        const refsCount = this.references
            ? getFullReferencesCount(this.references)
            : undefined
        return [
            {
                key: "narrative",
                label: "Narrative chart",
                render: () => <NarrativeChartInfo name={this.name} />,
            },
            {
                key: "refs",
                label: refsCount !== undefined ? `Refs (${refsCount})` : "Refs",
                render: () => (
                    <EditorReferencesTabForNarrativeChart
                        references={this.references}
                        configId={this.configId}
                    />
                ),
            },
        ]
    }

    private readonly renderSaveButtons = (
        editor: ConfigEditor,
        editingErrors: string[]
    ): React.ReactNode => (
        <NarrativeChartSaveButtons
            editor={editor}
            editingErrors={editingErrors}
            parentUrl={this.parentUrl}
            chart={{
                status: "saved",
                name: this.name,
                configId: this.configId,
            }}
        />
    )

    private renderEditor(): React.ReactElement {
        return (
            <GrapherEditor
                key={this.props.narrativeChartId}
                config={this.patchConfig}
                baseConfig={this.parentConfig}
                store={this.store}
                details={this.details}
                scatterDefaults={this.scatterDefaults}
                onSave={this.onSave}
                extraTabs={this.extraTabs}
                renderSaveButtons={this.renderSaveButtons}
                previewUrl={this.previewUrl}
                originUrlSuggestions={this.originUrlSuggestions}
            />
        )
    }

    override render(): React.ReactElement {
        return (
            <AdminLayout noSidebar>
                {this.isLoaded ? (
                    this.renderEditor()
                ) : (
                    <main className="ChartEditorPage">
                        <LoadingBlocker isLoading />
                    </main>
                )}
            </AdminLayout>
        )
    }
}
