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
} from "./IndicatorChartEditor.js"

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

    isNewGrapher = false

    async fetchGrapher(): Promise<void> {
        const { variableId } = this.props
        const config = await this.context.admin.getJSON(
            `/api/variables/grapherConfigAdmin/${variableId}.patchConfig.json`
        )
        if (isEmpty(config)) {
            this.isNewGrapher = true
            this.patchConfig = {
                dimensions: [{ variableId, property: DimensionProperty.y }],
            }
        }
    }

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get editor(): IndicatorChartEditor {
        return new IndicatorChartEditor({ manager: this })
    }

    @action.bound refresh(): void {
        void this.fetchGrapher()
    }

    componentDidMount(): void {
        this.refresh()
    }

    // This funny construction allows the "new chart" link to work by forcing an update
    // even if the props don't change. This fix used to work, but doesn't anymore.
    // UNSAFE_componentWillReceiveProps(): void {
    //     setTimeout(() => this.refresh(), 0)
    // }

    render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
