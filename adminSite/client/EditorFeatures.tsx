import { computed } from "mobx"
import { ChartEditor } from "./ChartEditor"

// Responsible for determining what parts of the editor should be shown, based on the
// type of chart being edited
export class EditorFeatures {
    editor: ChartEditor
    constructor(editor: ChartEditor) {
        this.editor = editor
    }

    @computed get chart() {
        return this.editor.grapher
    }

    @computed get canCustomizeYAxisScale() {
        return !this.chart.isStackedArea && !this.chart.isStackedBar
    }

    @computed get canCustomizeXAxisScale() {
        return this.chart.isScatter
    }

    @computed get canCustomizeYAxisLabel() {
        return this.chart.isScatter
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
        return this.chart.isScatter
    }

    @computed get timeDomain() {
        return !this.chart.isDiscreteBar
    }

    @computed get timelineRange() {
        return !this.chart.isDiscreteBar
    }

    @computed get showYearLabels() {
        return this.chart.isDiscreteBar
    }

    @computed get hideLegend() {
        return this.chart.isLineChart || this.chart.isStackedArea
    }

    @computed get stackedArea() {
        return this.chart.isStackedArea
    }

    @computed get entityType() {
        return (
            (!this.chart.isScatter &&
                this.chart.addCountryMode === "add-country") ||
            this.chart.addCountryMode === "change-country"
        )
    }

    @computed get relativeModeToggle() {
        return (
            this.chart.isStackedArea ||
            this.chart.isLineChart ||
            this.chart.isScatter
        )
    }

    @computed get comparisonLine() {
        return this.chart.isLineChart || this.chart.isScatter
    }

    @computed get explorer() {
        return this.editor.props.admin.settings.EXPLORER
    }
}
