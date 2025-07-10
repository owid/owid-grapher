import * as React from "react"
import { useHistory, useLocation } from "react-router-dom"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { ObservedReactComponent } from "@ourworldindata/components"
import type { History } from "history"

import { GrapherInterface } from "@ourworldindata/utils"
import {
    isKebabCase,
    NARRATIVE_CHART_KEBAB_CASE_ERROR_MSG,
} from "../adminShared/validation.js"
import { Admin } from "./Admin.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"
import {
    NarrativeChartEditor,
    NarrativeChartEditorManager,
} from "./NarrativeChartEditor.js"
import { NotFoundPage } from "./NotFoundPage.js"

export function CreateNarrativeChartEditorPage() {
    const history = useHistory()
    const { search } = useLocation()
    const searchParams = new URLSearchParams(search)
    const type = searchParams.get("type")
    const chartConfigId = searchParams.get("chartConfigId")
    if (type === "multiDim" && chartConfigId) {
        return (
            <CreateNarrativeChartEditorPageInternal
                type="multiDim"
                chartConfigId={chartConfigId}
                history={history}
            />
        )
    }
    return <NotFoundPage />
}

interface CreateNarrativeChartEditorPageInternalProps {
    type: "multiDim"
    chartConfigId: string
    history: History
}

@observer
class CreateNarrativeChartEditorPageInternal
    extends ObservedReactComponent<CreateNarrativeChartEditorPageInternalProps>
    implements
        NarrativeChartEditorManager,
        ChartEditorViewManager<NarrativeChartEditor>
{
    static contextType = AdminAppContext
    context!: AdminAppContextType

    id?: number
    @observable name?: string
    @observable nameError?: string
    configId?: string
    patchConfig: GrapherInterface = {}
    fullConfig: GrapherInterface = {}
    parentConfig: GrapherInterface = {}
    parentUrl: string | null = null

    isInheritanceEnabled: boolean | undefined = true

    references = undefined

    async fetchNarrativeChartData(): Promise<void> {
        const chartConfig = await this.context.admin.getJSON(
            `/api/chart-configs/${this.props.chartConfigId}.config.json`
        )
        this.parentConfig = chartConfig.full
    }

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get history(): History {
        return this.observedProps.history
    }

    @computed get editor(): NarrativeChartEditor {
        return new NarrativeChartEditor({ manager: this })
    }

    @computed get parentChartConfigId(): string | undefined {
        return this.observedProps.chartConfigId
    }

    @action.bound onNameChange(value: string) {
        this.name = value
        this.nameError = isKebabCase(value)
            ? undefined
            : NARRATIVE_CHART_KEBAB_CASE_ERROR_MSG
    }

    @action.bound refresh(): void {
        void this.fetchNarrativeChartData()
    }

    componentDidMount(): void {
        this.refresh()
    }

    render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
