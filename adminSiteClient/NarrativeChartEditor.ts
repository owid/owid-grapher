import type { History } from "history"
import { computed, runInAction, makeObservable } from "mobx"
import {
    AbstractChartEditor,
    AbstractChartEditorManager,
    References,
    type EditorTab,
} from "./AbstractChartEditor.js"
import { makeNarrativeChartPatchConfig } from "./narrativeChartConfig.js"
import { GrapherInterface } from "@ourworldindata/types"

export interface Chart {
    id: number
    title?: string
    variantName?: string
    isChild: boolean
}

export interface NarrativeChartEditorManager extends AbstractChartEditorManager {
    history: History
    narrativeChartId?: number
    name?: string
    nameError?: string
    onNameChange: (value: string) => void
    configId?: string
    parentChartConfigId?: string
    parentUrl: string | null
    references: References | undefined
}

export class NarrativeChartEditor extends AbstractChartEditor<NarrativeChartEditorManager> {
    constructor(props: { manager: NarrativeChartEditorManager }) {
        super(props)
        makeObservable(this)
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

    override get patchConfig(): GrapherInterface {
        return makeNarrativeChartPatchConfig(
            this.liveConfigWithDefaults,
            this.activeParentConfigWithDefaults
        )
    }

    @computed get narrativeChartId(): number | undefined {
        return this.manager.narrativeChartId
    }

    @computed get isNewGrapher(): boolean {
        return this.narrativeChartId === undefined
    }

    @computed get parentUrl(): string | null {
        return this.manager.parentUrl
    }

    async createGrapher(): Promise<void> {
        const { manager, patchConfig } = this
        manager.nameError = ""
        const body = {
            type: "multiDim",
            name: manager.name,
            parentChartConfigId: manager.parentChartConfigId,
            config: patchConfig,
        }
        const json = await manager.admin.requestJSON(
            "/api/narrative-charts",
            body,
            "POST"
        )
        if (json.success) {
            manager.history.push(
                `/narrative-charts/${json.narrativeChartId}/edit`
            )
        } else {
            manager.nameError = json.errorMsg
        }
    }

    async saveGrapher({
        onError,
    }: { onError?: () => void } = {}): Promise<void> {
        const { patchConfig, narrativeChartId } = this

        const json = await this.manager.admin.requestJSON(
            `/api/narrative-charts/${narrativeChartId}`,
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

export function isNarrativeChartEditorInstance(
    editor: AbstractChartEditor
): editor is NarrativeChartEditor {
    return editor instanceof NarrativeChartEditor
}
