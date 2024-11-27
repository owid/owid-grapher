import React from "react"
import { observer } from "mobx-react"
import { computed, action } from "mobx"
import { GrapherInterface } from "@ourworldindata/types"
import { Admin } from "./Admin.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"
import { ChartViewEditor, ChartViewEditorManager } from "./ChartViewEditor.js"

@observer
export class ChartViewEditorPage
    extends React.Component<{
        chartViewId: number
    }>
    implements ChartViewEditorManager, ChartEditorViewManager<ChartViewEditor>
{
    static contextType = AdminAppContext
    context!: AdminAppContextType

    idAndSlug: { id: number; slug: string } | undefined = undefined

    patchConfig: GrapherInterface = {}
    fullConfig: GrapherInterface = {}
    parentChartId: number = 0
    parentConfig: GrapherInterface = {}

    isInheritanceEnabled: boolean | undefined = true

    async fetchChartViewData(): Promise<void> {
        const data = await this.context.admin.getJSON(
            `/api/chartViews/${this.chartViewId}`
        )

        this.idAndSlug = { id: data.id, slug: data.slug }
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

    @action.bound refresh(): void {
        void this.fetchChartViewData()
    }

    componentDidMount(): void {
        this.refresh()
    }

    render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
