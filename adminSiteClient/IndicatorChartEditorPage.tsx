import React from "react"
import { observer } from "mobx-react"
import { computed, action } from "mobx"
import { isEmpty } from "@ourworldindata/utils"
import { GrapherInterface, DimensionProperty } from "@ourworldindata/types"
import { Admin } from "./Admin.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"
import {
    IndicatorChartEditor,
    IndicatorChartEditorManager,
    type Chart,
} from "./IndicatorChartEditor.js"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"

@observer
export class IndicatorChartEditorPage
    extends React.Component<{
        variableId: number
    }>
    implements
        IndicatorChartEditorManager,
        ChartEditorViewManager<IndicatorChartEditor>
{
    static contextType = AdminAppContext
    context!: AdminAppContextType

    patchConfig: GrapherInterface = {}
    parentConfig: GrapherInterface | undefined = undefined

    charts: Chart[] = []

    isNewGrapher: boolean | undefined = undefined
    isInheritanceEnabled: boolean | undefined = undefined

    async fetchGrapherConfig(): Promise<void> {
        const { variableId } = this
        const config = await this.context.admin.getJSON(
            `/api/variables/grapherConfigAdmin/${variableId}.patchConfig.json`
        )
        if (isEmpty(config)) {
            this.patchConfig = {
                $schema: latestGrapherConfigSchema,
                dimensions: [{ variableId, property: DimensionProperty.y }],
            }
            this.isNewGrapher = true
        } else {
            this.patchConfig = config
            this.isNewGrapher = false
        }
    }

    async fetchParentConfig(): Promise<void> {
        const { variableId } = this
        const etlConfig = await this.context.admin.getJSON(
            `/api/variables/grapherConfigETL/${variableId}.patchConfig.json`
        )
        this.parentConfig = isEmpty(etlConfig) ? undefined : etlConfig
        this.isInheritanceEnabled = true
    }

    async fetchCharts(): Promise<void> {
        const { variableId } = this
        this.charts = await this.context.admin.getJSON(
            `/api/variables/${variableId}/charts.json`
        )
    }

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get variableId(): number {
        return this.props.variableId
    }

    @computed get editor(): IndicatorChartEditor {
        return new IndicatorChartEditor({ manager: this })
    }

    @action.bound refresh(): void {
        void this.fetchGrapherConfig()
        void this.fetchParentConfig()
        void this.fetchCharts()
    }

    componentDidMount(): void {
        this.refresh()
    }

    render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
