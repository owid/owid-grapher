import { computed } from "mobx"
import {
    AbstractChartEditor,
    AbstractChartEditorManager,
    type EditorTab,
} from "./AbstractChartEditor.js"

export interface IndicatorChartEditorManager
    extends AbstractChartEditorManager {
    isNewGrapher: boolean
}

export class IndicatorChartEditor extends AbstractChartEditor<IndicatorChartEditorManager> {
    @computed get availableTabs(): EditorTab[] {
        const tabs: EditorTab[] = ["basic", "data", "text", "customize"]
        if (this.grapher.hasMapTab) tabs.push("map")
        if (this.grapher.isScatter) tabs.push("scatter")
        if (this.grapher.isMarimekko) tabs.push("marimekko")
        tabs.push("export")
        return tabs
    }

    @computed get isNewGrapher() {
        return this.manager.isNewGrapher
    }

    async saveGrapher({
        onError,
    }: { onError?: () => void } = {}): Promise<void> {
        console.log("Implementation missing")
        onError?.()
    }
}

export function isIndicatorChartEditorInstance(
    editor: AbstractChartEditor
): editor is IndicatorChartEditor {
    return editor instanceof IndicatorChartEditor
}
