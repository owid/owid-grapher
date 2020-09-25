import * as React from "react"
import { debounce } from "grapher/utils/Util"
import { observable, computed, action, toJS } from "mobx"
import { observer } from "mobx-react"
import { Grapher } from "grapher/core/Grapher"
import { ComparisonLineConfig } from "grapher/scatterCharts/ComparisonLine"
import { Toggle, NumberField, SelectField, TextField, Section } from "./Forms"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    ScatterPointLabelStrategy,
    HighlightToggleConfig,
} from "grapher/core/GrapherConstants"

@observer
export class EditorScatterTab extends React.Component<{ grapher: Grapher }> {
    @observable comparisonLine: ComparisonLineConfig = { yEquals: undefined }
    @observable highlightToggle: HighlightToggleConfig = {
        description: "",
        paramStr: "",
    }

    @computed get hasHighlightToggle() {
        return !!this.props.grapher.highlightToggle
    }

    constructor(props: { grapher: Grapher }) {
        super(props)
        this.highlightToggle = {
            ...this.highlightToggle,
            ...props.grapher.highlightToggle,
        }
    }

    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.grapher.hideTimeline = value || undefined
    }

    @action.bound onToggleHideLinesOutsideTolerance(value: boolean) {
        this.props.grapher.hideLinesOutsideTolerance = value || undefined
    }

    @action.bound onXOverrideYear(value: number | undefined) {
        this.props.grapher.xOverrideTime = value
    }

    @action.bound onToggleHighlightToggle(value: boolean) {
        if (value) this.props.grapher.highlightToggle = this.highlightToggle
        else this.props.grapher.highlightToggle = undefined
    }

    save() {
        if (this.hasHighlightToggle)
            this.props.grapher.highlightToggle = toJS(this.highlightToggle)
    }

    @computed get excludedEntityChoices() {
        return this.props.grapher.getEntityNamesToShow()
    }

    @action.bound onExcludeEntity(entity: string) {
        const { grapher } = this.props
        if (grapher.excludedEntities === undefined) {
            grapher.excludedEntities = []
        }

        const entityId = grapher.table.entityNameToIdMap.get(entity)!
        if (grapher.excludedEntities.indexOf(entityId) === -1)
            grapher.excludedEntities.push(entityId)
    }

    @action.bound onUnexcludeEntity(entity: string) {
        const { grapher } = this.props
        if (!grapher.excludedEntities) return

        const entityId = grapher.table.entityNameToIdMap.get(entity)
        grapher.excludedEntities = grapher.excludedEntities.filter(
            (e) => e !== entityId
        )
    }

    @action.bound onToggleConnection(value: boolean) {
        const { grapher } = this.props
        grapher.hideConnectedScatterLines = value
    }

    @action.bound onChangeScatterPointLabelStrategy(value: string) {
        this.props.grapher.scatterPointLabelStrategy = value as ScatterPointLabelStrategy
    }

    render() {
        const {
            hasHighlightToggle,
            highlightToggle,
            excludedEntityChoices,
        } = this
        const { grapher } = this.props

        return (
            <div className="EditorScatterTab">
                <Section name="Timeline">
                    <Toggle
                        label="Hide timeline"
                        value={!!grapher.hideTimeline}
                        onValue={this.onToggleHideTimeline}
                    />
                    <Toggle
                        label="Hide entities without data for full time span (within tolerance)"
                        value={!!grapher.hideLinesOutsideTolerance}
                        onValue={this.onToggleHideLinesOutsideTolerance}
                    />
                    <Toggle
                        label="Hide connected scatter lines"
                        value={!!grapher.hideConnectedScatterLines}
                        onValue={this.onToggleConnection}
                    />
                    <NumberField
                        label="Override X axis target year"
                        value={grapher.xOverrideTime}
                        onValue={debounce(this.onXOverrideYear, 300)}
                        allowNegative
                    />
                </Section>
                <Section name="Point Labels">
                    <SelectField
                        value={grapher.scatterPointLabelStrategy}
                        onValue={this.onChangeScatterPointLabelStrategy}
                        options={Object.keys(ScatterPointLabelStrategy)}
                    />
                </Section>
                <Section name="Filtering">
                    <Toggle
                        label="Exclude entities that do not belong in any color group"
                        value={!!grapher.matchingEntitiesOnly}
                        onValue={action(
                            (value: boolean) =>
                                (grapher.matchingEntitiesOnly =
                                    value || undefined)
                        )}
                    />
                    <SelectField
                        label="Exclude individual entities"
                        placeholder="Select an entity to exclude"
                        value={undefined}
                        onValue={(v) => v && this.onExcludeEntity(v)}
                        options={excludedEntityChoices}
                    />
                    {grapher.excludedEntityNames && (
                        <ul className="excludedEntities">
                            {grapher.excludedEntityNames.map((entity) => (
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
