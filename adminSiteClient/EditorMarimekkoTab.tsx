import React from "react"
import { debounce, excludeUndefined } from "../clientUtils/Util.js"
import { computed, action, IReactionDisposer, reaction, observable } from "mobx"
import { observer } from "mobx-react"
import { Grapher } from "../grapher/core/Grapher.js"
import { Toggle, NumberField, SelectField, Section, Button } from "./Forms.js"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { EntityName } from "../coreTable/OwidTableConstants.js"
import { faTrash } from "@fortawesome/free-solid-svg-icons/faTrash.js"
import lodash from "lodash-es"
import { grapherKeysToSerialize } from "../grapher/core/GrapherInterface.js"
import { tSParenthesizedType } from "@babel/types"

@observer
export class EditorMarimekkoTab extends React.Component<{ grapher: Grapher }> {
    @observable xOverrideTimeInputField: number | undefined
    constructor(props: { grapher: Grapher }) {
        super(props)
        this.xOverrideTimeInputField = props.grapher.xOverrideTime
    }

    @computed private get includedEntityNames(): EntityName[] {
        const { includedEntities, inputTable } = this.props.grapher
        const { entityIdToNameMap } = inputTable
        const includedEntityIds = includedEntities ?? []
        return excludeUndefined(
            includedEntityIds.map((entityId) => entityIdToNameMap.get(entityId))
        )
    }

    @computed private get includedEntityChoices() {
        const { inputTable } = this.props.grapher
        return inputTable.availableEntityNames
            .filter(
                (entityName) => !this.includedEntityNames.includes(entityName)
            )
            .sort()
    }

    @action.bound onIncludeEntity(entity: string) {
        const { grapher } = this.props
        if (grapher.includedEntities === undefined) {
            grapher.includedEntities = []
        }

        const entityId = grapher.table.entityNameToIdMap.get(entity)!
        if (grapher.includedEntities.indexOf(entityId) === -1)
            grapher.includedEntities.push(entityId)
    }

    @action.bound onUnincludeEntity(entity: string) {
        const { grapher } = this.props
        if (!grapher.includedEntities) return

        const entityId = grapher.table.entityNameToIdMap.get(entity)
        grapher.includedEntities = grapher.includedEntities.filter(
            (e) => e !== entityId
        )
    }

    @computed private get excludedEntityNames(): EntityName[] {
        const { excludedEntities, inputTable } = this.props.grapher
        const { entityIdToNameMap } = inputTable
        const excludedEntityIds = excludedEntities ?? []
        return excludeUndefined(
            excludedEntityIds.map((entityId) => entityIdToNameMap.get(entityId))
        )
    }

    @computed private get excludedEntityChoices() {
        const { inputTable } = this.props.grapher
        return inputTable.availableEntityNames
            .filter(
                (entityName) => !this.excludedEntityNames.includes(entityName)
            )
            .sort()
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

    @action.bound onClearExcludedEntities() {
        const { grapher } = this.props
        grapher.excludedEntities = []
    }

    @action.bound onClearIncludedEntities() {
        const { grapher } = this.props
        grapher.includedEntities = []
    }

    @action.bound onXOverrideYear(value: number | undefined) {
        this.xOverrideTimeInputField = value
    }
    render() {
        const { excludedEntityChoices, includedEntityChoices } = this
        const { grapher } = this.props

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
                    (this.props.grapher.xOverrideTime =
                        this.xOverrideTimeInputField),
                800
            )
        )
    }

    componentWillUnmount() {
        this.dispose()
    }
}
