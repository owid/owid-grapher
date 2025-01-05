import { faMinus, faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    EntityName,
    ComparisonLineConfig,
    ScatterPointLabelStrategy,
} from "@ourworldindata/types"
import { Grapher, GrapherState } from "@ourworldindata/grapher"
import { debounce, excludeUndefined } from "@ourworldindata/utils"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { NumberField, Section, SelectField, Toggle } from "./Forms.js"

@observer
export class EditorScatterTab extends Component<{
    grapherState: GrapherState
}> {
    @observable comparisonLine: ComparisonLineConfig = { yEquals: undefined }

    constructor(props: { grapherState: GrapherState }) {
        super(props)
    }

    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.grapherState.hideTimeline = value || undefined
    }

    @action.bound onToggleHideScatterLabels(value: boolean) {
        this.props.grapherState.hideScatterLabels = value || undefined
    }

    @action.bound onXOverrideYear(value: number | undefined) {
        this.props.grapherState.xOverrideTime = value
    }

    @computed private get includedEntityNames(): EntityName[] {
        const { includedEntities, inputTable } = this.props.grapherState
        const { entityIdToNameMap } = inputTable
        const includedEntityIds = includedEntities ?? []
        return excludeUndefined(
            includedEntityIds.map((entityId) => entityIdToNameMap.get(entityId))
        )
    }

    @computed private get excludedEntityNames(): EntityName[] {
        const { excludedEntities, inputTable } = this.props.grapherState
        const { entityIdToNameMap } = inputTable
        const excludedEntityIds = excludedEntities ?? []
        return excludeUndefined(
            excludedEntityIds.map((entityId) => entityIdToNameMap.get(entityId))
        )
    }

    @computed private get includedEntityChoices() {
        const { inputTable } = this.props.grapherState
        return inputTable.availableEntityNames
            .filter(
                (entityName) => !this.includedEntityNames.includes(entityName)
            )
            .sort()
    }

    @computed private get excludedEntityChoices() {
        const { inputTable } = this.props.grapherState
        return inputTable.availableEntityNames
            .filter(
                (entityName) => !this.excludedEntityNames.includes(entityName)
            )
            .sort()
    }

    @action.bound onExcludeEntity(entity: string) {
        const { grapherState } = this.props
        if (grapherState.excludedEntities === undefined) {
            grapherState.excludedEntities = []
        }

        const entityId = grapherState.table.entityNameToIdMap.get(entity)!
        if (grapherState.excludedEntities.indexOf(entityId) === -1)
            grapherState.excludedEntities.push(entityId)
    }

    @action.bound onUnexcludeEntity(entity: string) {
        const { grapherState } = this.props
        if (!grapherState.excludedEntities) return

        const entityId = grapherState.table.entityNameToIdMap.get(entity)
        grapherState.excludedEntities = grapherState.excludedEntities.filter(
            (e) => e !== entityId
        )
    }

    @action.bound onIncludeEntity(entity: string) {
        const { grapherState } = this.props
        if (grapherState.includedEntities === undefined) {
            grapherState.includedEntities = []
        }

        const entityId = grapherState.table.entityNameToIdMap.get(entity)!
        if (grapherState.includedEntities.indexOf(entityId) === -1)
            grapherState.includedEntities.push(entityId)
    }

    @action.bound onUnincludeEntity(entity: string) {
        const { grapherState } = this.props
        if (!grapherState.includedEntities) return

        const entityId = grapherState.table.entityNameToIdMap.get(entity)
        grapherState.includedEntities = grapherState.includedEntities.filter(
            (e) => e !== entityId
        )
    }

    @action.bound onClearExcludedEntities() {
        const { grapherState } = this.props
        grapherState.excludedEntities = []
    }

    @action.bound onClearIncludedEntities() {
        const { grapherState } = this.props
        grapherState.includedEntities = []
    }

    @action.bound onToggleConnection(value: boolean) {
        const { grapherState } = this.props
        grapherState.hideConnectedScatterLines = value
    }

    @action.bound onChangeScatterPointLabelStrategy(value: string) {
        this.props.grapherState.scatterPointLabelStrategy =
            value as ScatterPointLabelStrategy
    }

    render() {
        const { includedEntityChoices, excludedEntityChoices } = this
        const { grapherState } = this.props

        return (
            <div className="EditorScatterTab">
                <Section name="Timeline">
                    <Toggle
                        label="Hide timeline"
                        value={!!grapherState.hideTimeline}
                        onValue={this.onToggleHideTimeline}
                    />
                    <Toggle
                        label="Hide connected scatter lines"
                        value={!!grapherState.hideConnectedScatterLines}
                        onValue={this.onToggleConnection}
                    />
                    <NumberField
                        label="Override X axis target year"
                        value={grapherState.xOverrideTime}
                        onValue={debounce(this.onXOverrideYear, 300)}
                        allowNegative
                    />
                </Section>
                <Section name="Point Labels">
                    <SelectField
                        value={grapherState.scatterPointLabelStrategy}
                        onValue={this.onChangeScatterPointLabelStrategy}
                        options={Object.keys(ScatterPointLabelStrategy).map(
                            (entry) => ({ value: entry })
                        )}
                    />
                    <Toggle
                        label="Hide point labels (except when hovering)"
                        value={!!grapherState.hideScatterLabels}
                        onValue={this.onToggleHideScatterLabels}
                    />
                </Section>
                <Section name="Filtering">
                    <Toggle
                        label="Exclude entities that do not belong in any color group"
                        value={!!grapherState.matchingEntitiesOnly}
                        onValue={action(
                            (value: boolean) =>
                                (grapherState.matchingEntitiesOnly =
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
