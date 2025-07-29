import React from "react"
import { observer } from "mobx-react"
import { observable, computed, runInAction, action, makeObservable } from "mobx"
import {
    getParentVariableIdFromChartConfig,
    RawPageview,
} from "@ourworldindata/utils"
import {
    GrapherInterface,
    ChartRedirect,
    MinimalTagWithIsTopic,
    DbChartTagJoin,
} from "@ourworldindata/types"
import { Admin } from "./Admin.js"
import {
    ChartEditor,
    Log,
    ChartEditorManager,
    fetchMergedGrapherConfigByVariableId,
} from "./ChartEditor.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"
import { References } from "./AbstractChartEditor.js"

interface ChartEditorPageProps {
    grapherId?: number
    grapherConfig?: GrapherInterface
}

@observer
export class ChartEditorPage
    extends React.Component<ChartEditorPageProps>
    implements ChartEditorManager, ChartEditorViewManager<ChartEditor>
{
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    constructor(props: ChartEditorPageProps) {
        super(props)
        makeObservable(this)
    }

    @observable accessor logs: Log[] = []
    @observable accessor references: References | undefined = undefined
    @observable accessor redirects: ChartRedirect[] = []
    @observable accessor pageviews?: RawPageview = undefined
    @observable accessor tags?: DbChartTagJoin[] = undefined
    @observable accessor availableTags?: MinimalTagWithIsTopic[] = undefined

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
            this.isInheritanceEnabled = parent?.isActive ?? true
        } else if (grapherConfig) {
            const parentIndicatorId =
                getParentVariableIdFromChartConfig(grapherConfig)
            if (parentIndicatorId) {
                this.parentConfig = await fetchMergedGrapherConfigByVariableId(
                    this.context.admin,
                    parentIndicatorId
                )
            }
            this.isInheritanceEnabled = true
        } else {
            this.isInheritanceEnabled = true
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

    async fetchTags(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? {}
                : await admin.getJSON(`/api/charts/${grapherId}.tags.json`)
        runInAction(() => (this.tags = json.tags))
    }

    async fetchAvailableTags() {
        const json = (await this.admin.getJSON("/api/tags.json")) as any
        this.availableTags = json.tags
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
        void this.fetchTags()
        void this.fetchAvailableTags()
    }

    override componentDidMount(): void {
        this.refresh()
    }

    override componentDidUpdate(
        prevProps: Readonly<{
            grapherId?: number
            grapherConfig?: GrapherInterface
        }>
    ): void {
        if (prevProps.grapherId !== this.props.grapherId) {
            void this.fetchTags()
        }
    }

    override render(): React.ReactElement {
        return <ChartEditorView manager={this} />
    }
}
