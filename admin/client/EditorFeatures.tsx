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
        return this.editor.chart
    }

    @computed get customYAxisScale() {
        return (
            !this.chart.isStackedArea &&
            !this.chart.isDiscreteBar &&
            !this.chart.isStackedBar
        )
    }

    @computed get customXAxisScale() {
        return this.chart.isScatter
    }

    @computed get customYAxisLabel() {
        return this.chart.isScatter
    }

    @computed get customXAxisLabel() {
        return true
    }

    @computed get customYAxis() {
        return this.customYAxisScale || this.customYAxisLabel
    }

    @computed get customXAxis() {
        return this.customXAxisScale || this.customXAxisLabel
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
            (this.chart.isScatter && this.chart.scatter.hasTimeline)
        )
    }

    @computed get comparisonLine() {
        return this.chart.isLineChart || this.chart.isScatter
    }

    @computed get explorer() {
        return this.editor.props.admin.settings.EXPLORER
    }
}
