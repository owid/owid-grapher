import * as React from "react"
import { debounce, excludeUndefined } from "../clientUtils/Util"
import { computed, action, IReactionDisposer, reaction, observable } from "mobx"
import { observer } from "mobx-react"
import { Grapher } from "../grapher/core/Grapher"
import { Toggle, NumberField, SelectField, Section } from "./Forms"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { EntityName } from "../coreTable/OwidTableConstants"
import lodash from "lodash"

@observer
export class EditorMarimekkoTab extends React.Component<{ grapher: Grapher }> {
    @observable xOverrideTimeInputField: number | undefined
    constructor(props: { grapher: Grapher }) {
        super(props)
        this.xOverrideTimeInputField = props.grapher.xOverrideTime
    }

    @computed private get excludedEntityNames(): EntityName[] {
        const { excludedEntities, inputTable } = this.props.grapher
        const { entityIdToNameMap } = inputTable
        const excludedEntityIds = excludedEntities ?? []
        return excludeUndefined(
            excludedEntityIds.map((entityId) => entityIdToNameMap.get(entityId))
        )
    }

    @computed private get invertExcludedEntitiesList(): boolean {
        return !!this.props.grapher.invertExcludedEntitiesList
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

    @action.bound onXOverrideYear(value: number | undefined) {
        this.xOverrideTimeInputField = value
    }

    @action.bound onUnexcludeEntity(entity: string) {
        const { grapher } = this.props
        if (!grapher.excludedEntities) return

        const entityId = grapher.table.entityNameToIdMap.get(entity)
        grapher.excludedEntities = grapher.excludedEntities.filter(
            (e) => e !== entityId
        )
    }

    render() {
        const { excludedEntityChoices, invertExcludedEntitiesList } = this
        const { grapher } = this.props

        return (
            <div className="EditorScatterTab">
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
                    <Toggle
                        label="Start with empty selection and explicitly add entities below"
                        value={invertExcludedEntitiesList}
                        onValue={action(
                            (value: boolean) =>
                                (grapher.invertExcludedEntitiesList =
                                    value || undefined)
                        )}
                    />
                    <SelectField
                        label={
                            invertExcludedEntitiesList
                                ? "Include individual entities"
                                : "Exclude individual entities"
                        }
                        placeholder={
                            "Select an entity to " +
                            (invertExcludedEntitiesList ? "include" : "exclude")
                        }
                        value={undefined}
                        onValue={(v) => v && this.onExcludeEntity(v)}
                        options={excludedEntityChoices}
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
                    (this.props.grapher.xOverrideTime = this.xOverrideTimeInputField),
                800
            )
        )
    }

    componentWillUnmount() {
        this.dispose()
    }
}
