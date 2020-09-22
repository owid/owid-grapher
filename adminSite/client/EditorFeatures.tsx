import { computed } from "mobx"
import { ChartEditor } from "./ChartEditor"

// Responsible for determining what parts of the editor should be shown, based on the
// type of chart being edited
export class EditorFeatures {
    editor: ChartEditor
    constructor(editor: ChartEditor) {
        this.editor = editor
    }

    @computed get grapher() {
        return this.editor.grapher
    }

    @computed get canCustomizeYAxisScale() {
        return !this.grapher.isStackedArea && !this.grapher.isStackedBar
    }

    @computed get canCustomizeXAxisScale() {
        return this.grapher.isScatter
    }

    @computed get canCustomizeYAxisLabel() {
        return this.grapher.isScatter
    }

    @computed get canCustomizeXAxisLabel() {
        return true
    }

    @computed get canCustomizeYAxis() {
        return this.canCustomizeYAxisScale || this.canCustomizeYAxisLabel
    }

    @computed get canCustomizeXAxis() {
        return this.canCustomizeXAxisScale || this.canCustomizeXAxisLabel
    }

    @computed get canRemovePointsOutsideAxisDomain() {
        return this.grapher.isScatter
    }

    @computed get timeDomain() {
        return !this.grapher.isDiscreteBar
    }

    @computed get timelineRange() {
        return !this.grapher.isDiscreteBar
    }

    @computed get showYearLabels() {
        return this.grapher.isDiscreteBar
    }

    @computed get hideLegend() {
        return this.grapher.isLineChart || this.grapher.isStackedArea
    }

    @computed get stackedArea() {
        return this.grapher.isStackedArea
    }

    @computed get entityType() {
        return (
            (!this.grapher.isScatter &&
                this.grapher.addCountryMode === "add-country") ||
            this.grapher.addCountryMode === "change-country"
        )
    }

    @computed get relativeModeToggle() {
        return (
            this.grapher.isStackedArea ||
            this.grapher.isLineChart ||
            this.grapher.isScatter
        )
    }

    @computed get comparisonLine() {
        return this.grapher.isLineChart || this.grapher.isScatter
    }

    @computed get explorer() {
        return this.editor.options.admin.settings.EXPLORER
    }
}
