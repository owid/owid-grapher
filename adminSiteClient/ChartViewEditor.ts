import { computed, runInAction } from "mobx"
import {
    AbstractChartEditor,
    AbstractChartEditorManager,
    References,
    type EditorTab,
} from "./AbstractChartEditor.js"
import {
    CHART_VIEW_PROPS_TO_OMIT,
    CHART_VIEW_PROPS_TO_PERSIST,
    GrapherInterface,
} from "@ourworldindata/types"
import { diffGrapherConfigs, omit, pick } from "@ourworldindata/utils"

export interface Chart {
    id: number
    title?: string
    variantName?: string
    isChild: boolean
}

export interface ChartViewEditorManager extends AbstractChartEditorManager {
    chartViewId: number
    idsAndName: { id: number; name: string; configId: string } | undefined
    parentChartId: number
    references: References | undefined
}

export class ChartViewEditor extends AbstractChartEditor<ChartViewEditorManager> {
    constructor(props: { manager: ChartViewEditorManager }) {
        super(props)
    }

    @computed
    get availableTabs(): EditorTab[] {
        const tabs: EditorTab[] = ["basic", "data", "text", "customize"]
        if (this.grapherState.hasMapTab) tabs.push("map")
        if (this.grapherState.isScatter) tabs.push("scatter")
        if (this.grapherState.isMarimekko) tabs.push("marimekko")
        tabs.push("refs")
        tabs.push("export")
        tabs.push("debug")
        return tabs
    }

    @computed get references() {
        return this.manager.references
    }

    @computed override get patchConfig(): GrapherInterface {
        const config = omit(
            this.liveConfigWithDefaults,
            CHART_VIEW_PROPS_TO_OMIT
        )

        const patchToParentChart = diffGrapherConfigs(
            config,
            this.activeParentConfigWithDefaults || {}
        )

        return {
            ...patchToParentChart,

            // We want to make sure we're explicitly persisting some props like entity selection
            // always, so they never change when the parent chart changes.
            // For this, we need to ensure we include the default layer, so that we even
            // persist these props when they are the same as the default.
            ...pick(this.liveConfigWithDefaults, CHART_VIEW_PROPS_TO_PERSIST),
        }
    }

    @computed get chartViewId(): number {
        return this.manager.chartViewId
    }

    @computed get isNewGrapher(): boolean {
        return false
    }

    @computed get parentChartId(): number {
        return this.manager.parentChartId
    }

    async saveGrapher({
        onError,
    }: { onError?: () => void } = {}): Promise<void> {
        const { patchConfig, chartViewId } = this

        const json = await this.manager.admin.requestJSON(
            `/api/chartViews/${chartViewId}`,
            { config: patchConfig },
            "PUT"
        )

        if (json.success) {
            runInAction(() => {
                this.savedPatchConfig = json.savedPatch
            })
        } else {
            onError?.()
        }
    }
}

export function isChartViewEditorInstance(
    editor: AbstractChartEditor
): editor is ChartViewEditor {
    return editor instanceof ChartViewEditor
}
