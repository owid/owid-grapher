/**
 * The admin's editor for an existing narrative chart: `GrapherEditor` with
 * the parent chart's full config as the base, plus the narrative chart's
 * record (its name, references, the parent link) plugged in from here.
 */
import React from "react"
import { Prompt } from "react-router-dom"
import { observer } from "mobx-react"
import { computed, action, runInAction, observable, makeObservable } from "mobx"
import type { History } from "history"
import { GrapherInterface } from "@ourworldindata/types"
import { CodeSnippet } from "@ourworldindata/components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faFile } from "@fortawesome/free-solid-svg-icons"
import { Admin } from "./Admin.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { LoadingBlocker, Section } from "./Forms.js"
import { GrapherEditor } from "./GrapherEditor.js"
import { ConfigEditor, EditorExtraTab } from "./ConfigEditor.js"
import { EditorReferencesTabForNarrativeChart } from "./EditorReferencesTab.js"
import { NarrativeChartSaveButtons } from "./NarrativeChartSaveButtons.js"
import { getFullReferencesCount, References } from "./adminChartApi.js"
import {
    adminDetailsProvider,
    adminEditorEnvironment,
    adminIndicatorCatalog,
    adminTopicSlugs,
} from "./adminEditorProviders.js"
import { dataApiIndicatorStore, IndicatorStore } from "./indicatorStores.js"
import { makeNarrativeChartPatchConfig } from "./narrativeChartConfig.js"

interface NarrativeChartEditorPageProps {
    narrativeChartId: number
    history: History
}

/** The ArchieML that embeds a narrative chart in a Google Doc. */
export function NarrativeChartInfo({ name }: { name: string }) {
    // In theory, it'd be great to use `rawToArchie` here, but that's in the `db` package
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

    constructor(props: NarrativeChartEditorPageProps) {
        super(props)
        makeObservable(this, {
            isLoaded: observable,
            name: observable.ref,
            configId: observable.ref,
            patchConfig: observable.ref,
            parentConfig: observable.ref,
            parentUrl: observable.ref,
            references: observable,
            isDirty: observable,
        })
    }

    isLoaded = false
    name = ""
    configId = ""
    patchConfig: GrapherInterface = {}
    /** The parent chart's full config: what this narrative chart is a patch on. */
    parentConfig: GrapherInterface | undefined = undefined
    parentUrl: string | null = null
    references: References | undefined = undefined
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

    override componentDidMount(): void {
        void this.fetchNarrativeChartData()
        void this.fetchRefs()
    }

    /**
     * A narrative chart is saved as a special patch: what it adds on top of
     * its parent, minus the props a narrative chart never carries, plus the
     * props it always persists (see `makeNarrativeChartPatchConfig`). The
     * editor's own generic patch is returned as the saved baseline, so the
     * editor's "modified" state stays consistent with what it computes.
     */
    @action.bound async onSave(
        patch: GrapherInterface,
        editor: ConfigEditor
    ): Promise<GrapherInterface> {
        const json = await this.admin.requestJSON(
            `/api/narrative-charts/${this.props.narrativeChartId}`,
            {
                config: makeNarrativeChartPatchConfig(
                    editor.liveConfigWithDefaults,
                    editor.activeParentConfigWithDefaults
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

    override render(): React.ReactElement {
        return (
            <AdminLayout noSidebar>
                <Prompt
                    when={this.isDirty}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />
                {this.isLoaded ? (
                    <GrapherEditor
                        key={this.props.narrativeChartId}
                        config={this.patchConfig}
                        baseConfig={this.parentConfig}
                        store={this.store}
                        details={adminDetailsProvider(this.admin)}
                        topicSlugs={adminTopicSlugs(this.admin)}
                        environment={adminEditorEnvironment}
                        syncTabWithUrl
                        onDirtyChange={action(
                            (isDirty: boolean) => (this.isDirty = isDirty)
                        )}
                        extraTabs={this.extraTabs}
                        renderSaveButtons={(editor, editingErrors) => (
                            <NarrativeChartSaveButtons
                                editor={editor}
                                editingErrors={editingErrors}
                                parentUrl={this.parentUrl}
                                existing={{
                                    name: this.name,
                                    configId: this.configId,
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
