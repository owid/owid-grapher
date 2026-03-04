import { computed, makeObservable } from "mobx"
import { AbstractChartEditor } from "./AbstractChartEditor.js"

// Responsible for determining what parts of the editor should be shown, based on the
// type of chart being edited
export class EditorFeatures {
    editor: AbstractChartEditor
    constructor(editor: AbstractChartEditor) {
        makeObservable(this)
        this.editor = editor
    }

    @computed get grapherState() {
        return this.editor.grapherState
    }

    @computed get canCustomizeXAxisScale() {
        return this.grapherState.hasScatter || this.grapherState.hasMarimekko
    }

    @computed get canCustomizeYAxisLabel() {
        return this.grapherState.hasScatter
    }

    @computed get canCustomizeXAxisLabel() {
        return (
            this.grapherState.hasLineChart ||
            this.grapherState.hasScatter ||
            this.grapherState.hasMarimekko ||
            this.grapherState.hasStackedArea ||
            this.grapherState.hasStackedBar
        )
    }

    @computed get canCustomizeXAxis() {
        return this.canCustomizeXAxisScale || this.canCustomizeXAxisLabel
    }

    @computed get canRemovePointsOutsideAxisDomain() {
        return this.grapherState.hasScatter
    }

    @computed get canEnableLogLinearToggle() {
        return (
            this.grapherState.hasLineChart ||
            this.grapherState.hasSlopeChart ||
            this.grapherState.hasScatter
        )
    }

    @computed get canSelectTimeRange() {
        return (
            this.grapherState.hasLineChart ||
            this.grapherState.hasSlopeChart ||
            this.grapherState.hasStackedBar ||
            this.grapherState.hasStackedArea ||
            this.grapherState.hasScatter
        )
    }

    @computed get canToggleShowYearLabels() {
        return this.grapherState.hasDiscreteBar
    }

    @computed get canHideSeriesLabels() {
        return (
            this.grapherState.hasLineChart ||
            this.grapherState.hasSlopeChart ||
            this.grapherState.hasStackedArea
        )
    }

    @computed get relativeModeToggle() {
        return (
            this.grapherState.hasStackedArea ||
            this.grapherState.hasStackedBar ||
            this.grapherState.hasStackedDiscreteBar ||
            this.grapherState.hasLineChart ||
            this.grapherState.hasSlopeChart ||
            this.grapherState.hasScatter ||
            this.grapherState.hasMarimekko
        )
    }

    @computed get canSpecifyCustomComparisonLines() {
        return (
            this.grapherState.hasLineChart ||
            this.grapherState.hasScatter ||
            this.grapherState.hasStackedArea ||
            this.grapherState.hasStackedBar ||
            this.grapherState.hasMarimekko
        )
    }

    @computed get canSpecifyVerticalComparisonLines() {
        return (
            this.grapherState.hasLineChart ||
            this.grapherState.hasScatter ||
            this.grapherState.hasStackedArea ||
            this.grapherState.hasStackedBar
        )
    }

    @computed get canSpecifyComparisonLines() {
        return (
            this.canSpecifyCustomComparisonLines ||
            this.canSpecifyVerticalComparisonLines
        )
    }

    @computed get canSpecifySortOrder() {
        return (
            this.grapherState.hasStackedDiscreteBar ||
            this.grapherState.hasDiscreteBar ||
            this.grapherState.hasMarimekko
        )
    }

    @computed get canSortByColumn() {
        return (
            this.grapherState.hasStackedDiscreteBar ||
            this.grapherState.hasMarimekko
        )
    }

    @computed get canHideTotalValueLabel() {
        return this.grapherState.hasStackedDiscreteBar
    }

    @computed get canCustomizeVariableType() {
        return this.grapherState.hasMultipleYColumns
    }

    @computed get canSpecifyMissingDataStrategy() {
        if (!this.grapherState.hasMultipleYColumns) return false

        if (
            this.grapherState.hasStackedArea ||
            this.grapherState.hasStackedBar ||
            this.grapherState.hasStackedDiscreteBar
        ) {
            return true
        }

        // For line and slope charts, specifying a missing data strategy
        // only makes sense if there are multiple entities
        if (this.grapherState.hasLineChart || this.grapherState.hasSlopeChart) {
            return (
                this.grapherState.canChangeEntity ||
                this.grapherState.canSelectMultipleEntities
            )
        }

        return false
    }

    @computed get showChangeInPrefixToggle() {
        return (
            (this.grapherState.hasLineChart ||
                this.grapherState.hasSlopeChart) &&
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
                this.grapherState.hasDiscreteBar ||
                this.grapherState.hasStackedDiscreteBar ||
                this.grapherState.hasMarimekko
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
