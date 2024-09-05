import { computed, observable, runInAction, when } from "mobx"
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
    isInheritanceEnabled: boolean
    isPublished: boolean
}

export interface IndicatorChartEditorManager
    extends AbstractChartEditorManager {
    variableId: number
    isNewGrapher?: boolean
    charts: Chart[]
}

export class IndicatorChartEditor extends AbstractChartEditor<IndicatorChartEditorManager> {
    @observable.ref _isNewGrapher: boolean | undefined = undefined

    constructor(props: { manager: IndicatorChartEditorManager }) {
        super(props)

        when(
            () => this.manager.isNewGrapher !== undefined,
            () => (this._isNewGrapher = this.manager.isNewGrapher)
        )
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

    @computed get variableId(): number {
        return this.manager.variableId
    }

    @computed get isNewGrapher(): boolean {
        return this._isNewGrapher ?? false
    }

    @computed get charts(): Chart[] {
        return this.manager.charts
    }

    async saveGrapher({
        onError,
    }: { onError?: () => void } = {}): Promise<void> {
        const { patchConfig, variableId } = this

        const json = await this.manager.admin.requestJSON(
            `/api/variables/${variableId}/grapherConfigAdmin`,
            patchConfig,
            "PUT"
        )

        if (json.success) {
            runInAction(() => {
                this.savedPatchConfig = json.savedPatch
                this._isNewGrapher = false
            })
        } else {
            onError?.()
        }
    }
}

export function isIndicatorChartEditorInstance(
    editor: AbstractChartEditor
): editor is IndicatorChartEditor {
    return editor instanceof IndicatorChartEditor
}
