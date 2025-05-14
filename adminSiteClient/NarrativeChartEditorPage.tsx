import React from "react"
import { observer } from "mobx-react"
import { computed, action, runInAction, observable } from "mobx"
import { GrapherInterface } from "@ourworldindata/types"
import { Admin } from "./Admin.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"
import {
    NarrativeChartEditor,
    NarrativeChartEditorManager,
} from "./NarrativeChartEditor.js"
import { References } from "./AbstractChartEditor.js"

@observer
export class NarrativeChartEditorPage
    extends React.Component<{
        narrativeChartId: number
    }>
    implements
        NarrativeChartEditorManager,
        ChartEditorViewManager<NarrativeChartEditor>
{
    static contextType = AdminAppContext
    context!: AdminAppContextType

    idsAndName: { id: number; name: string; configId: string } | undefined =
        undefined

    patchConfig: GrapherInterface = {}
    fullConfig: GrapherInterface = {}
    parentChartId: number = 0
    parentConfig: GrapherInterface = {}

    isInheritanceEnabled: boolean | undefined = true

    @observable references: References | undefined = undefined

    async fetchNarrativeChartData(): Promise<void> {
        const data = await this.context.admin.getJSON(
            `/api/narrative-charts/${this.narrativeChartId}.config.json`
        )

        this.idsAndName = {
            id: data.id,
            name: data.name,
            configId: data.chartConfigId,
        }
        this.fullConfig = data.configFull
        this.patchConfig = data.configPatch
        this.parentChartId = data.parentChartId
        this.parentConfig = data.parentConfigFull
    }

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get narrativeChartId(): number {
        return this.props.narrativeChartId
    }

    @computed get editor(): NarrativeChartEditor {
        return new NarrativeChartEditor({ manager: this })
    }

    async fetchRefs(): Promise<void> {
        const { admin } = this.context
        const json =
            this.narrativeChartId === undefined
                ? {}
                : await admin.getJSON(
                      `/api/narrative-charts/${this.narrativeChartId}.references.json`
                  )
        runInAction(() => (this.references = json.references))
    }

    @action.bound refresh(): void {
        void this.fetchNarrativeChartData()
        void this.fetchRefs()
    }

    componentDidMount(): void {
        this.refresh()
    }

    render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
