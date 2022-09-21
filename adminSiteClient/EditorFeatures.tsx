import { EntitySelectionMode } from "../grapher/core/GrapherConstants.js"
import { computed, makeObservable } from "mobx"
import { ChartEditor } from "./ChartEditor.js"

// Responsible for determining what parts of the editor should be shown, based on the
// type of chart being edited
export class EditorFeatures {
    editor: ChartEditor
    constructor(editor: ChartEditor) {
        makeObservable(this, {
            grapher: computed,
            canCustomizeYAxisScale: computed,
            canCustomizeXAxisScale: computed,
            canCustomizeYAxisLabel: computed,
            canCustomizeXAxisLabel: computed,
            canCustomizeYAxis: computed,
            canCustomizeXAxis: computed,
            canRemovePointsOutsideAxisDomain: computed,
            timeDomain: computed,
            timelineRange: computed,
            showYearLabels: computed,
            hideLegend: computed,
            stackedArea: computed,
            entityType: computed,
            relativeModeToggle: computed,
            comparisonLine: computed,
            canSpecifySortOrder: computed,
            canSortByColumn: computed,
            canHideTotalValueLabel: computed,
        })

        this.editor = editor
    }

    get grapher() {
        return this.editor.grapher
    }

    get canCustomizeYAxisScale() {
        return !this.grapher.isStackedArea && !this.grapher.isStackedBar
    }

    get canCustomizeXAxisScale() {
        return this.grapher.isScatter || this.grapher.isMarimekko
    }

    get canCustomizeYAxisLabel() {
        return this.grapher.isScatter || this.grapher.isMarimekko
    }

    get canCustomizeXAxisLabel() {
        return true
    }

    get canCustomizeYAxis() {
        return this.canCustomizeYAxisScale || this.canCustomizeYAxisLabel
    }

    get canCustomizeXAxis() {
        return this.canCustomizeXAxisScale || this.canCustomizeXAxisLabel
    }

    get canRemovePointsOutsideAxisDomain() {
        return this.grapher.isScatter
    }

    get timeDomain() {
        return !this.grapher.isDiscreteBar
    }

    get timelineRange() {
        return !this.grapher.isDiscreteBar
    }

    get showYearLabels() {
        return this.grapher.isDiscreteBar
    }

    get hideLegend() {
        return (
            this.grapher.isLineChart ||
            this.grapher.isStackedArea ||
            this.grapher.isStackedDiscreteBar
        )
    }

    get stackedArea() {
        return this.grapher.isStackedArea
    }

    get entityType() {
        return this.grapher.addCountryMode !== EntitySelectionMode.Disabled
    }

    get relativeModeToggle() {
        return (
            this.grapher.isStackedArea ||
            this.grapher.isStackedDiscreteBar ||
            this.grapher.isLineChart ||
            this.grapher.isScatter ||
            this.grapher.isMarimekko
        )
    }

    get comparisonLine() {
        return this.grapher.isLineChart || this.grapher.isScatter
    }

    get canSpecifySortOrder() {
        return (
            this.grapher.isStackedDiscreteBar ||
            this.grapher.isLineChart ||
            this.grapher.isDiscreteBar ||
            this.grapher.isMarimekko
        )
    }

    get canSortByColumn() {
        return this.grapher.isStackedDiscreteBar || this.grapher.isMarimekko
    }

    get canHideTotalValueLabel() {
        return this.grapher.isStackedDiscreteBar
    }
}
