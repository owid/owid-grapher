import { computed } from "mobx"
import { AbstractChartEditor } from "./AbstractChartEditor.js"

// Responsible for determining what parts of the editor should be shown, based on the
// type of chart being edited
export class EditorFeatures {
    editor: AbstractChartEditor
    constructor(editor: AbstractChartEditor) {
        this.editor = editor
    }

    @computed get grapher() {
        return this.editor.grapher
    }

    @computed get canCustomizeYAxisScale() {
        return !this.grapher.isStackedArea && !this.grapher.isStackedBar
    }

    @computed get canCustomizeXAxisScale() {
        return this.grapher.isScatter || this.grapher.isMarimekko
    }

    @computed get canCustomizeYAxisLabel() {
        return this.grapher.isScatter || this.grapher.isMarimekko
    }

    @computed get canCustomizeXAxisLabel() {
        return (
            this.grapher.isLineChart ||
            this.grapher.isScatter ||
            this.grapher.isMarimekko ||
            this.grapher.isStackedArea ||
            this.grapher.isStackedBar
        )
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
        return (
            this.grapher.isLineChart ||
            this.grapher.isSlopeChart ||
            this.grapher.isStackedArea ||
            this.grapher.isStackedDiscreteBar
        )
    }

    @computed get stackedArea() {
        return this.grapher.isStackedArea
    }

    @computed get relativeModeToggle() {
        return (
            this.grapher.isStackedArea ||
            this.grapher.isStackedBar ||
            this.grapher.isStackedDiscreteBar ||
            this.grapher.isLineChart ||
            this.grapher.isScatter ||
            this.grapher.isMarimekko
        )
    }

    @computed get comparisonLine() {
        return this.grapher.isLineChart || this.grapher.isScatter
    }

    @computed get canSpecifySortOrder() {
        return (
            this.grapher.isStackedDiscreteBar ||
            this.grapher.isLineChart ||
            this.grapher.isDiscreteBar ||
            this.grapher.isMarimekko
        )
    }

    @computed get canSortByColumn() {
        return this.grapher.isStackedDiscreteBar || this.grapher.isMarimekko
    }

    @computed get canHideTotalValueLabel() {
        return this.grapher.isStackedDiscreteBar
    }

    @computed get canCustomizeVariableType() {
        return this.grapher.hasMultipleYColumns
    }

    @computed get canSpecifyMissingDataStrategy() {
        if (!this.grapher.hasMultipleYColumns) return false

        if (
            this.grapher.isStackedArea ||
            this.grapher.isStackedBar ||
            this.grapher.isStackedDiscreteBar
        ) {
            return true
        }

        // for line and slope charts, specifying a missing data strategy only makes sense
        // if there are multiple entities
        if (this.grapher.isLineChart || this.grapher.isSlopeChart) {
            return (
                this.grapher.canChangeEntity ||
                this.grapher.canSelectMultipleEntities
            )
        }

        return false
    }

    @computed get showChangeInPrefixToggle() {
        return (
            (this.grapher.isLineChart || this.grapher.isSlopeChart) &&
            (this.grapher.isRelativeMode || this.grapher.canToggleRelativeMode)
        )
    }

    @computed get showEntityAnnotationInTitleToggle() {
        return (
            !this.grapher.canChangeEntity &&
            !this.grapher.canSelectMultipleEntities
        )
    }

    @computed get showTimeAnnotationInTitleToggle() {
        return (
            !this.grapher.hasTimeline ||
            !(
                this.grapher.isDiscreteBar ||
                this.grapher.isStackedDiscreteBar ||
                this.grapher.isMarimekko
            )
        )
    }
}
