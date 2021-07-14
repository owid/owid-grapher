import * as React from "react"
import { debounce, excludeUndefined } from "../clientUtils/Util"
import { observable, computed, action, toJS } from "mobx"
import { observer } from "mobx-react"
import { Grapher } from "../grapher/core/Grapher"
import { ComparisonLineConfig } from "../grapher/scatterCharts/ComparisonLine"
import { Toggle, NumberField, SelectField, TextField, Section } from "./Forms"
import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    ScatterPointLabelStrategy,
    HighlightToggleConfig,
} from "../grapher/core/GrapherConstants"
import { EntityName } from "../coreTable/OwidTableConstants"

@observer
export class EditorMarimekkoTab extends React.Component<{ grapher: Grapher }> {
    constructor(props: { grapher: Grapher }) {
        super(props)
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

    render() {
        const { excludedEntityChoices } = this
        const { grapher } = this.props

        return (
            <div className="EditorScatterTab">
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
}
