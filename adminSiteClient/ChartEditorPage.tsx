import React from "react"
import { observer } from "mobx-react"
import { observable, computed, runInAction, action } from "mobx"
import {
    getParentVariableIdFromChartConfig,
    RawPageview,
} from "@ourworldindata/utils"
import { GrapherInterface, ChartRedirect } from "@ourworldindata/types"
import { Admin } from "./Admin.js"
import {
    ChartEditor,
    Log,
    References,
    ChartEditorManager,
    fetchMergedGrapherConfigByVariableId,
} from "./ChartEditor.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"

@observer
export class ChartEditorPage
    extends React.Component<{
        grapherId?: number
        grapherConfig?: GrapherInterface
    }>
    implements ChartEditorManager, ChartEditorViewManager<ChartEditor>
{
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable logs: Log[] = []
    @observable references: References | undefined = undefined
    @observable redirects: ChartRedirect[] = []
    @observable pageviews?: RawPageview = undefined

    patchConfig: GrapherInterface = {}
    parentConfig: GrapherInterface | undefined = undefined

    isInheritanceEnabled: boolean | undefined = undefined

    async fetchGrapherConfig(): Promise<void> {
        const { grapherId, grapherConfig } = this.props
        if (grapherId !== undefined) {
            this.patchConfig = await this.context.admin.getJSON(
                `/api/charts/${grapherId}.patchConfig.json`
            )
        } else if (grapherConfig) {
            this.patchConfig = grapherConfig
        }
    }

    async fetchParentConfig(): Promise<void> {
        const { grapherId, grapherConfig } = this.props
        if (grapherId !== undefined) {
            const parent = await this.context.admin.getJSON(
                `/api/charts/${grapherId}.parent.json`
            )
            this.parentConfig = parent?.config
            this.isInheritanceEnabled = parent?.isActive ?? false
        } else if (grapherConfig) {
            const parentIndicatorId =
                getParentVariableIdFromChartConfig(grapherConfig)
            if (parentIndicatorId) {
                this.parentConfig = await fetchMergedGrapherConfigByVariableId(
                    this.context.admin,
                    parentIndicatorId
                )
            }
            this.isInheritanceEnabled = false
        }
    }

    async fetchLogs(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? {}
                : await admin.getJSON(`/api/charts/${grapherId}.logs.json`)
        runInAction(() => (this.logs = json.logs))
    }

    async fetchRefs(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? {}
                : await admin.getJSON(
                      `/api/charts/${grapherId}.references.json`
                  )
        runInAction(() => (this.references = json.references))
    }

    async fetchRedirects(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? {}
                : await admin.getJSON(`/api/charts/${grapherId}.redirects.json`)
        runInAction(() => (this.redirects = json.redirects))
    }

    async fetchPageviews(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? {}
                : await admin.getJSON(`/api/charts/${grapherId}.pageviews.json`)
        runInAction(() => (this.pageviews = json.pageviews))
    }

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get editor(): ChartEditor {
        return new ChartEditor({ manager: this })
    }

    @action.bound refresh(): void {
        void this.fetchGrapherConfig()
        void this.fetchParentConfig()
        void this.fetchLogs()
        void this.fetchRefs()
        void this.fetchRedirects()
        void this.fetchPageviews()
    }

    componentDidMount(): void {
        this.refresh()
    }

    render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
