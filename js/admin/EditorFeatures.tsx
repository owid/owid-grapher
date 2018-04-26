import { computed } from 'mobx'
import ChartEditor from './ChartEditor'

// Responsible for determining what parts of the editor should be shown, based on the
// type of chart being edited
export default class EditorFeatures {
    editor: ChartEditor
    constructor(editor: ChartEditor) {
        this.editor = editor
    }

    @computed get chart() {
        return this.editor.chart
    }

    @computed get customYAxis() {
        return !this.chart.isStackedArea && !this.chart.isDiscreteBar
    }

    @computed get customXAxis() {
        return this.chart.isScatter
    }

    @computed get timeDomain() { return !this.chart.isDiscreteBar }

    @computed get hideLegend() {
        return this.chart.isLineChart || this.chart.isStackedArea
    }

    @computed get stackedArea() {
        return this.chart.isStackedArea
    }

    @computed get entityType() {
        return (!this.chart.isScatter && this.chart.addCountryMode === 'add-country') || this.chart.addCountryMode === 'change-country'
    }

    @computed get relativeModeToggle() {
        return this.chart.isStackedArea || (this.chart.isScatter && this.chart.scatter.hasTimeline)
    }

    @computed get comparisonLine() {
        return this.chart.isLineChart || this.chart.isScatter
    }
}
