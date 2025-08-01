import React from "react"
import { observer } from "mobx-react"
import { computed, action, runInAction, observable, makeObservable } from "mobx"
import type { History } from "history"
import { GrapherInterface } from "@ourworldindata/types"
import { Admin } from "./Admin.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"
import {
    NarrativeChartEditor,
    NarrativeChartEditorManager,
} from "./NarrativeChartEditor.js"
import { References } from "./AbstractChartEditor.js"

interface NarrativeChartEditorPageProps {
    narrativeChartId: number
    history: History
}

@observer
export class NarrativeChartEditorPage
    extends React.Component<NarrativeChartEditorPageProps>
    implements
        NarrativeChartEditorManager,
        ChartEditorViewManager<NarrativeChartEditor>
{
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    constructor(props: NarrativeChartEditorPageProps) {
        super(props)
        makeObservable(this)
    }

    id?: number
    name?: string
    configId?: string
    patchConfig: GrapherInterface = {}
    fullConfig: GrapherInterface = {}
    parentChartId: number = 0
    parentConfig: GrapherInterface = {}
    parentUrl: string | null = null

    isInheritanceEnabled: boolean | undefined = true

    @observable references: References | undefined = undefined

    async fetchNarrativeChartData(): Promise<void> {
        const data = await this.context.admin.getJSON(
            `/api/narrative-charts/${this.narrativeChartId}.config.json`
        )
        this.id = data.id
        this.name = data.name
        this.configId = data.chartConfigId
        this.fullConfig = data.configFull
        this.patchConfig = data.configPatch
        this.parentChartId = data.parentChartId
        this.parentConfig = data.parentConfigFull
        this.parentUrl = data.parentUrl
    }

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get history(): History {
        return this.props.history
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

    @action.bound onNameChange(_: string) {
        // Name is not editable once the narrative chart is created.
        return undefined
    }

    @action.bound refresh(): void {
        void this.fetchNarrativeChartData()
        void this.fetchRefs()
    }

    override componentDidMount(): void {
        this.refresh()
    }

    override render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
