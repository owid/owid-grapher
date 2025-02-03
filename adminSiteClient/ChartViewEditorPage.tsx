import React from "react"
import { observer } from "mobx-react"
import { computed, action, runInAction, observable } from "mobx"
import { GrapherInterface } from "@ourworldindata/types"
import { Admin } from "./Admin.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"
import { ChartViewEditor, ChartViewEditorManager } from "./ChartViewEditor.js"
import { References } from "./AbstractChartEditor.js"

@observer
export class ChartViewEditorPage
    extends React.Component<{
        chartViewId: number
    }>
    implements ChartViewEditorManager, ChartEditorViewManager<ChartViewEditor>
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

    async fetchChartViewData(): Promise<void> {
        const data = await this.context.admin.getJSON(
            `/api/chartViews/${this.chartViewId}.config.json`
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

    @computed get chartViewId(): number {
        return this.props.chartViewId
    }

    @computed get editor(): ChartViewEditor {
        return new ChartViewEditor({ manager: this })
    }

    async fetchRefs(): Promise<void> {
        const { admin } = this.context
        const json =
            this.chartViewId === undefined
                ? {}
                : await admin.getJSON(
                      `/api/chartViews/${this.chartViewId}.references.json`
                  )
        runInAction(() => (this.references = json.references))
    }

    @action.bound refresh(): void {
        void this.fetchChartViewData()
        void this.fetchRefs()
    }

    componentDidMount(): void {
        this.refresh()
    }

    render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
