import {computed} from 'mobx'
import ChartEditor from './ChartEditor'
import ChartType from '../charts/ChartType'

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
        return true
    }

    @computed get customXAxis() {
        return this.chart.type == ChartType.ScatterPlot
    }

    @computed get hideLegend() {
        return this.chart.type == ChartType.LineChart || this.chart.type == ChartType.StackedArea
    }

    @computed get stackedArea() {
        return this.chart.type == ChartType.StackedArea
    }
}