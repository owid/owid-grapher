import { faMinus, faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { EntityName } from "@ourworldindata/types"
import { Grapher, GrapherState } from "@ourworldindata/grapher"
import { excludeUndefined } from "@ourworldindata/utils"
import lodash from "lodash"
import { action, computed, IReactionDisposer, observable, reaction } from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import { NumberField, Section, SelectField, Toggle } from "./Forms.js"

@observer
export class EditorMarimekkoTab extends Component<{
    grapherState: GrapherState
}> {
    @observable xOverrideTimeInputField: number | undefined
    constructor(props: { grapherState: GrapherState }) {
        super(props)
        this.xOverrideTimeInputField = props.grapherState.xOverrideTime
    }

    @computed private get includedEntityNames(): EntityName[] {
        const { includedEntities, inputTable } = this.props.grapherState
        const { entityIdToNameMap } = inputTable
        const includedEntityIds = includedEntities ?? []
        return excludeUndefined(
            includedEntityIds.map((entityId) => entityIdToNameMap.get(entityId))
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

    @computed private get excludedEntityNames(): EntityName[] {
        const { excludedEntities, inputTable } = this.props.grapherState
        const { entityIdToNameMap } = inputTable
        const excludedEntityIds = excludedEntities ?? []
        return excludeUndefined(
            excludedEntityIds.map((entityId) => entityIdToNameMap.get(entityId))
        )
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

    @action.bound onClearExcludedEntities() {
        const { grapherState } = this.props
        grapherState.excludedEntities = []
    }

    @action.bound onClearIncludedEntities() {
        const { grapherState } = this.props
        grapherState.includedEntities = []
    }

    @action.bound onXOverrideYear(value: number | undefined) {
        this.xOverrideTimeInputField = value
    }
    render() {
        const { excludedEntityChoices, includedEntityChoices } = this
        const { grapherState } = this.props

        return (
            <div className="EditorMarimekkoTab">
                <Section name="Filtering">
                    <NumberField
                        label="Override X axis target year"
                        value={this.xOverrideTimeInputField}
                        onValue={this.onXOverrideYear}
                        allowNegative
                    />

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
                        label={"Exclude individual entities"}
                        placeholder={"Select an entity to exclude"}
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
    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = reaction(
            () => this.xOverrideTimeInputField,
            lodash.debounce(
                () =>
                    (this.props.grapherState.xOverrideTime =
                        this.xOverrideTimeInputField),
                800
            )
        )
    }

    componentWillUnmount() {
        this.dispose()
    }
}
