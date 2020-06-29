import * as React from "react"
import { extend, debounce } from "charts/Util"
import { observable, computed, action, toJS } from "mobx"
import { observer } from "mobx-react"
import {
    ChartConfig,
    HighlightToggleConfig,
    ScatterPointLabelStrategy
} from "charts/ChartConfig"
import { ComparisonLineConfig } from "charts/ComparisonLine"
import { Toggle, NumberField, SelectField, TextField, Section } from "./Forms"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

@observer
export class EditorScatterTab extends React.Component<{ chart: ChartConfig }> {
    @observable comparisonLine: ComparisonLineConfig = { yEquals: undefined }
    @observable highlightToggle: HighlightToggleConfig = {
        description: "",
        paramStr: ""
    }

    @computed get hasHighlightToggle() {
        return !!this.props.chart.highlightToggle
    }

    constructor(props: { chart: ChartConfig }) {
        super(props)
        extend(this.highlightToggle, props.chart.highlightToggle)
    }

    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.chart.props.hideTimeline = value || undefined
    }

    @action.bound onToggleHideLinesOutsideTolerance(value: boolean) {
        this.props.chart.props.hideLinesOutsideTolerance = value || undefined
    }

    @action.bound onXOverrideYear(value: number | undefined) {
        this.props.chart.scatter.xOverrideYear = value
    }

    @action.bound onToggleHighlightToggle(value: boolean) {
        if (value) this.props.chart.props.highlightToggle = this.highlightToggle
        else this.props.chart.props.highlightToggle = undefined
    }

    save() {
        if (this.hasHighlightToggle)
            this.props.chart.props.highlightToggle = toJS(this.highlightToggle)
    }

    @computed get excludedEntityChoices(): string[] {
        return this.props.chart.scatter.getEntitiesToShow()
    }

    @action.bound onExcludeEntity(entity: string) {
        const { chart } = this.props
        if (chart.props.excludedEntities === undefined) {
            chart.props.excludedEntities = []
        }

        const entityId = chart.table.entityNameToIdMap.get(entity)!
        if (chart.props.excludedEntities.indexOf(entityId) === -1)
            chart.props.excludedEntities.push(entityId)
    }

    @action.bound onUnexcludeEntity(entity: string) {
        const { chart } = this.props
        if (!chart.props.excludedEntities) return

        const entityId = chart.table.entityNameToIdMap.get(entity)
        chart.props.excludedEntities = chart.props.excludedEntities.filter(
            e => e !== entityId
        )
    }

    @action.bound onToggleConnection(value: boolean) {
        const { chart } = this.props
        chart.props.hideConnectedScatterLines = value
    }

    @action.bound onChangeScatterPointLabelStrategy(value: string) {
        this.props.chart.props.scatterPointLabelStrategy = value as ScatterPointLabelStrategy
    }

    render() {
        const {
            hasHighlightToggle,
            highlightToggle,
            excludedEntityChoices
        } = this
        const { chart } = this.props

        return (
            <div className="EditorScatterTab">
                <Section name="Timeline">
                    <Toggle
                        label="Hide timeline"
                        value={!!chart.props.hideTimeline}
                        onValue={this.onToggleHideTimeline}
                    />
                    <Toggle
                        label="Hide entities without data for full time span (within tolerance)"
                        value={!!chart.props.hideLinesOutsideTolerance}
                        onValue={this.onToggleHideLinesOutsideTolerance}
                    />
                    <Toggle
                        label="Hide connected scatter lines"
                        value={!!chart.props.hideConnectedScatterLines}
                        onValue={this.onToggleConnection}
                    />
                    <NumberField
                        label="Override X axis target year"
                        value={chart.scatter.xOverrideYear}
                        onValue={debounce(this.onXOverrideYear, 300)}
                        allowNegative
                    />
                </Section>
                <Section name="Point Labels">
                    <SelectField
                        value={chart.props.scatterPointLabelStrategy}
                        onValue={this.onChangeScatterPointLabelStrategy}
                        options={["year", "y", "x"]}
                    />
                </Section>
                <Section name="Filtering">
                    <Toggle
                        label="Exclude entities that do not belong in any color group"
                        value={!!chart.props.matchingEntitiesOnly}
                        onValue={action(
                            (value: boolean) =>
                                (chart.props.matchingEntitiesOnly =
                                    value || undefined)
                        )}
                    />
                    <SelectField
                        label="Exclude individual entities"
                        placeholder="Select an entity to exclude"
                        value={undefined}
                        onValue={v => v && this.onExcludeEntity(v)}
                        options={excludedEntityChoices}
                    />
                    {chart.scatter.excludedEntities && (
                        <ul className="excludedEntities">
                            {chart.scatter.excludedEntities.map(entity => (
                                <li key={entity}>
                                    <div
                                        className="clickable"
                                        onClick={() =>
                                            this.onUnexcludeEntity(entity)
                                        }
                                    >
                                        <FontAwesomeIcon icon={faMinus} />
                                    </div>
                                    {entity}
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>
                <Section name="Highlight toggle">
                    <p>
                        Allow users to toggle a particular chart selection state
                        to highlight certain entities.
                    </p>
                    <Toggle
                        label="Enable highlight toggle"
                        value={!!hasHighlightToggle}
                        onValue={this.onToggleHighlightToggle}
                    />
                    {hasHighlightToggle && (
                        <div>
                            <TextField
                                label="Description"
                                value={highlightToggle.description}
                                onValue={action((value: string) => {
                                    this.highlightToggle.description = value
                                    this.save()
                                })}
                            />
                            <TextField
                                label="URL Params"
                                placeholder="e.g. ?country=AFG"
                                value={highlightToggle.paramStr}
                                onValue={action((value: string) => {
                                    this.highlightToggle.paramStr = value
                                    this.save()
                                })}
                            />
                        </div>
                    )}
                </Section>
            </div>
        )
    }
}
