import React from "react"
import { observer } from "mobx-react"
import { observable, computed, runInAction, action } from "mobx"
import {
    getParentIndicatorIdFromChartConfig,
    RawPageview,
    isEmpty,
} from "@ourworldindata/utils"
import { Topic, GrapherInterface, ChartRedirect } from "@ourworldindata/types"
import { Admin } from "./Admin.js"
import {
    ChartEditor,
    Log,
    References,
    ChartEditorManager,
    fetchParentConfigForChart,
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
    @observable logs: Log[] = []
    @observable references: References | undefined = undefined
    static contextType = AdminAppContext

    patchConfig: GrapherInterface = {}
    parentConfig: GrapherInterface | undefined = undefined

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
            const parentConfig = await this.context.admin.getJSON(
                `/api/charts/${grapherId}.parentConfig.json`
            )
            this.parentConfig = isEmpty(parentConfig) ? undefined : parentConfig
        } else if (grapherConfig) {
            const parentIndicatorId =
                getParentIndicatorIdFromChartConfig(grapherConfig)
            if (parentIndicatorId) {
                this.parentConfig = await fetchParentConfigForChart(
                    this.context.admin,
                    parentIndicatorId
                )
            }
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

    async fetchTopics(): Promise<void> {
        const { admin } = this.context
        const json = await admin.getJSON(`/api/topics.json`)
        runInAction(() => (this.allTopics = json.topics))
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

        // (2024-02-15) Disabled due to slow query performance
        // https://github.com/owid/owid-grapher/issues/3198
        // this.fetchTopics()
    }

    componentDidMount(): void {
        this.refresh()
    }

    // TODO(inheritance)
    // This funny construction allows the "new chart" link to work by forcing an update
    // even if the props don't change
    // UNSAFE_componentWillReceiveProps(): void {
    //     setTimeout(() => this.refresh(), 0)
    // }

    render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
