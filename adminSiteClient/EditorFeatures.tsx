import { computed } from "mobx"
import { AbstractChartEditor } from "./AbstractChartEditor.js"

// Responsible for determining what parts of the editor should be shown, based on the
// type of chart being edited
export class EditorFeatures {
    editor: AbstractChartEditor
    constructor(editor: AbstractChartEditor) {
        this.editor = editor
    }

    @computed get grapherState() {
        return this.editor.grapherState
    }

    @computed get canCustomizeYAxisScale() {
        return (
            !this.grapherState.isStackedArea && !this.grapherState.isStackedBar
        )
    }

    @computed get canCustomizeXAxisScale() {
        return this.grapherState.isScatter || this.grapherState.isMarimekko
    }

    @computed get canCustomizeYAxisLabel() {
        return this.grapherState.isScatter || this.grapherState.isMarimekko
    }

    @computed get canCustomizeXAxisLabel() {
        return (
            this.grapherState.isLineChart ||
            this.grapherState.isScatter ||
            this.grapherState.isMarimekko ||
            this.grapherState.isStackedArea ||
            this.grapherState.isStackedBar
        )
    }

    @computed get canCustomizeYAxis() {
        return this.canCustomizeYAxisScale || this.canCustomizeYAxisLabel
    }

    @computed get canCustomizeXAxis() {
        return this.canCustomizeXAxisScale || this.canCustomizeXAxisLabel
    }

    @computed get canRemovePointsOutsideAxisDomain() {
        return this.grapherState.isScatter
    }

    @computed get canEnableLogLinearToggle() {
        return !this.grapher.isDiscreteBar && !this.grapher.isStackedDiscreteBar
    }

    @computed get timeDomain() {
        return !this.grapherState.isDiscreteBar
    }

    @computed get timelineRange() {
        return !this.grapherState.isDiscreteBar
    }

    @computed get showYearLabels() {
        return this.grapherState.isDiscreteBar
    }

    @computed get hideLegend() {
        return (
            this.grapherState.isLineChart ||
            this.grapherState.isSlopeChart ||
            this.grapherState.isStackedArea ||
            this.grapherState.isStackedDiscreteBar
        )
    }

    @computed get stackedArea() {
        return this.grapherState.isStackedArea
    }

    @computed get relativeModeToggle() {
        return (
            this.grapherState.isStackedArea ||
            this.grapherState.isStackedBar ||
            this.grapherState.isStackedDiscreteBar ||
            this.grapherState.isLineChart ||
            this.grapherState.isSlopeChart ||
            this.grapherState.isScatter ||
            this.grapherState.isMarimekko
        )
    }

    @computed get comparisonLine() {
        return this.grapherState.isLineChart || this.grapherState.isScatter
    }

    @computed get canSpecifySortOrder() {
        return (
            this.grapherState.isStackedDiscreteBar ||
            this.grapherState.isLineChart ||
            this.grapherState.isDiscreteBar ||
            this.grapherState.isMarimekko
        )
    }

    @computed get canSortByColumn() {
        return (
            this.grapherState.isStackedDiscreteBar ||
            this.grapherState.isMarimekko
        )
    }

    @computed get canHideTotalValueLabel() {
        return this.grapherState.isStackedDiscreteBar
    }

    @computed get canCustomizeVariableType() {
        return this.grapherState.hasMultipleYColumns
    }

    @computed get canSpecifyMissingDataStrategy() {
        if (!this.grapherState.hasMultipleYColumns) return false

        if (
            this.grapherState.isStackedArea ||
            this.grapherState.isStackedBar ||
            this.grapherState.isStackedDiscreteBar
        ) {
            return true
        }

        // for line and slope charts, specifying a missing data strategy only makes sense
        // if there are multiple entities
        if (this.grapherState.isLineChart || this.grapherState.isSlopeChart) {
            return (
                this.grapherState.canChangeEntity ||
                this.grapherState.canSelectMultipleEntities
            )
        }

        return false
    }

    @computed get showChangeInPrefixToggle() {
        return (
            (this.grapherState.isLineChart || this.grapherState.isSlopeChart) &&
            (this.grapherState.isRelativeMode ||
                this.grapherState.canToggleRelativeMode)
        )
    }

    @computed get showEntityAnnotationInTitleToggle() {
        return (
            !this.grapherState.canChangeEntity &&
            !this.grapherState.canSelectMultipleEntities
        )
    }

    @computed get showTimeAnnotationInTitleToggle() {
        return (
            !this.grapherState.hasTimeline ||
            !(
                this.grapherState.isDiscreteBar ||
                this.grapherState.isStackedDiscreteBar ||
                this.grapherState.isMarimekko
            )
        )
    }

    @computed get canHighlightSeries() {
        return (
            (this.grapherState.hasLineChart ||
                this.grapherState.hasSlopeChart) &&
            this.grapherState.isOnChartTab
        )
    }
}
