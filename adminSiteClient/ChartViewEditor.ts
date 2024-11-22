import { computed, runInAction } from "mobx"
import {
    AbstractChartEditor,
    AbstractChartEditorManager,
    type EditorTab,
} from "./AbstractChartEditor.js"

export interface Chart {
    id: number
    title?: string
    variantName?: string
    isChild: boolean
}

export interface ChartViewEditorManager extends AbstractChartEditorManager {
    chartViewId: number
}

export class ChartViewEditor extends AbstractChartEditor<ChartViewEditorManager> {
    constructor(props: { manager: ChartViewEditorManager }) {
        super(props)
    }

    @computed
    get availableTabs(): EditorTab[] {
        const tabs: EditorTab[] = ["basic", "data", "text", "customize"]
        if (this.grapher.hasMapTab) tabs.push("map")
        if (this.grapher.isScatter) tabs.push("scatter")
        if (this.grapher.isMarimekko) tabs.push("marimekko")
        tabs.push("inheritance")
        tabs.push("debug")
        return tabs
    }

    @computed get chartViewId(): number {
        return this.manager.chartViewId
    }

    @computed get isNewGrapher(): boolean {
        return false
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
