import { faMinus, faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    EntityName,
    ComparisonLineConfig,
    ScatterPointLabelStrategy,
} from "@ourworldindata/types"
import { Grapher } from "@ourworldindata/grapher"
import { debounce } from "@ourworldindata/utils"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { NumberField, Section, SelectField, Toggle } from "./Forms.js"

@observer
export class EditorScatterTab extends Component<{ grapher: Grapher }> {
    @observable comparisonLine: ComparisonLineConfig = { yEquals: undefined }

    constructor(props: { grapher: Grapher }) {
        super(props)
    }

    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.grapher.hideTimeline = value || undefined
    }

    @action.bound onToggleHideScatterLabels(value: boolean) {
        this.props.grapher.hideScatterLabels = value || undefined
    }

    @action.bound onXOverrideYear(value: number | undefined) {
        this.props.grapher.xOverrideTime = value
    }

    @computed private get includedEntityNames(): EntityName[] {
        return this.props.grapher.includedEntityNames ?? []
    }

    @computed private get excludedEntityNames(): EntityName[] {
        return this.props.grapher.excludedEntityNames ?? []
    }

    @computed private get includedEntityChoices() {
        const { inputTable, includedEntityNames = [] } = this.props.grapher
        return inputTable.availableEntityNames
            .filter((entityName) => !includedEntityNames.includes(entityName))
            .sort()
    }

    @computed private get excludedEntityChoices() {
        const { inputTable, excludedEntityNames = [] } = this.props.grapher
        return inputTable.availableEntityNames
            .filter((entityName) => !excludedEntityNames.includes(entityName))
            .sort()
    }

    @action.bound onExcludeEntity(entityName: string) {
        const { grapher } = this.props
        if (grapher.excludedEntityNames === undefined) {
            grapher.excludedEntityNames = []
        }

        if (!grapher.excludedEntityNames.includes(entityName))
            grapher.excludedEntityNames.push(entityName)
    }

    @action.bound onUnexcludeEntity(entityName: string) {
        const { grapher } = this.props
        if (!grapher.excludedEntityNames) return
        grapher.excludedEntityNames = grapher.excludedEntityNames.filter(
            (e) => e !== entityName
        )
    }

    @action.bound onIncludeEntity(entityName: string) {
        const { grapher } = this.props
        if (grapher.includedEntityNames === undefined) {
            grapher.includedEntityNames = []
        }

        if (!grapher.includedEntityNames.includes(entityName))
            grapher.includedEntityNames.push(entityName)
    }

    @action.bound onUnincludeEntity(entityName: string) {
        const { grapher } = this.props
        if (!grapher.includedEntityNames) return
        grapher.includedEntityNames = grapher.includedEntityNames.filter(
            (e) => e !== entityName
        )
    }

    @action.bound onClearExcludedEntities() {
        const { grapher } = this.props
        grapher.excludedEntityNames = []
    }

    @action.bound onClearIncludedEntities() {
        const { grapher } = this.props
        grapher.includedEntityNames = []
    }

    @action.bound onToggleConnection(value: boolean) {
        const { grapher } = this.props
        grapher.hideConnectedScatterLines = value
    }

    @action.bound onChangeScatterPointLabelStrategy(value: string) {
        this.props.grapher.scatterPointLabelStrategy =
            value as ScatterPointLabelStrategy
    }

    render() {
        const { includedEntityChoices, excludedEntityChoices } = this
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
                        options={Object.keys(ScatterPointLabelStrategy).map(
                            (entry) => ({ value: entry })
                        )}
                    />
                    <Toggle
                        label="Hide point labels (except when hovering)"
                        value={!!grapher.hideScatterLabels}
                        onValue={this.onToggleHideScatterLabels}
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
                </Section>
                <Section name="Manual entity selection">
                    <SelectField
                        label={
                            "Explicit start selection (leave empty to show all entities)"
                        }
                        placeholder={"Select an entity to include"}
                        value={undefined}
                        onValue={(v) => v && this.onIncludeEntity(v)}
                        options={includedEntityChoices.map((entry) => ({
                            value: entry,
                        }))}
                    />
                    {this.includedEntityNames && (
                        <ul className="includedEntities">
                            {this.includedEntityNames.map((entity) => (
                                <li key={entity}>
                                    <div
                                        className="clickable"
                                        onClick={() =>
                                            this.onUnincludeEntity(entity)
                                        }
                                    >
                                        <FontAwesomeIcon icon={faMinus} />
                                    </div>
                                    {entity}
                                </li>
                            ))}
                        </ul>
                    )}
                    {this.includedEntityNames && (
                        <button
                            className="btn btn-light btn-clear-selection"
                            onClick={this.onClearIncludedEntities}
                        >
                            <FontAwesomeIcon icon={faTrash} /> Clear start
                            selection
                        </button>
                    )}
                    <SelectField
                        label="Exclude individual entities"
                        placeholder="Select an entity to exclude"
                        value={undefined}
                        onValue={(v) => v && this.onExcludeEntity(v)}
                        options={excludedEntityChoices.map((entry) => ({
                            value: entry,
                        }))}
                    />
                    {this.excludedEntityNames && (
                        <ul className="excludedEntities">
                            {this.excludedEntityNames.map((entity) => (
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
                    {this.excludedEntityNames && (
                        <button
                            className="btn btn-light btn-clear-selection"
                            onClick={this.onClearExcludedEntities}
                        >
                            <FontAwesomeIcon icon={faTrash} /> Clear exclude
                            list
                        </button>
                    )}
                </Section>
            </div>
        )
    }
}
