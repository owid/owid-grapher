import * as React from "react"
import { useHistory, useLocation } from "react-router-dom"
import { action, computed, makeObservable, observable } from "mobx"
import { observer } from "mobx-react"
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
    extends React.Component<CreateNarrativeChartEditorPageInternalProps>
    implements
        NarrativeChartEditorManager,
        ChartEditorViewManager<NarrativeChartEditor>
{
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    constructor(props: CreateNarrativeChartEditorPageInternalProps) {
        super(props)
        makeObservable(this)
    }

    id?: number
    @observable name: string | undefined = undefined
    @observable nameError: string | undefined = undefined
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
        return this.props.history
    }

    @computed get editor(): NarrativeChartEditor {
        return new NarrativeChartEditor({ manager: this })
    }

    @computed get parentChartConfigId(): string | undefined {
        return this.props.chartConfigId
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

    override componentDidMount(): void {
        this.refresh()
    }

    override render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
