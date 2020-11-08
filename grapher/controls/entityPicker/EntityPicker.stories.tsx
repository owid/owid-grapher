import * as React from "react"
import { EntityPicker } from "grapher/controls/entityPicker/EntityPicker"
import { observer } from "mobx-react"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ColumnSlug, SortOrder } from "coreTable/CoreTableConstants"
import { EntityName, OwidTableSlugs } from "coreTable/OwidTableConstants"
import { EntityPickerManager } from "grapher/controls/entityPicker/EntityPickerConstants"
import { computed, observable } from "mobx"
import { SelectionArray } from "grapher/selection/SelectionArray"

class PickerHolder extends React.Component {
    render() {
        return (
            <div
                style={{
                    padding: "20px",
                    height: "500px",
                    width: "300px",
                    display: "grid",
                }}
            >
                {this.props.children}
            </div>
        )
    }
}

const defaultSlugs = [
    OwidTableSlugs.entityName,
    SampleColumnSlugs.GDP,
    SampleColumnSlugs.Population,
]

// A stub class for testing
@observer
class SomeThingWithAPicker
    extends React.Component<{
        pickerSlugs?: ColumnSlug[]
        selection?: EntityName[]
    }>
    implements EntityPickerManager {
    entityPickerTable = SynthesizeGDPTable({ entityCount: 30 }, 1)

    @observable entityPickerMetric?: ColumnSlug
    @observable entityPickerSort?: SortOrder

    @computed get pickerColumnSlugs() {
        return this.props.pickerSlugs
    }

    selectionArray = new SelectionArray(
        this.props.selection ?? [],
        this.entityPickerTable.availableEntities
    )

    requiredColumnSlugs = defaultSlugs

    render() {
        return (
            <PickerHolder>
                <EntityPicker manager={this} />
            </PickerHolder>
        )
    }
}

export default {
    title: "EntityPicker",
    component: EntityPicker,
}

export const Empty = () => (
    <PickerHolder>
        <EntityPicker
            manager={{
                selectionArray: new SelectionArray(),
            }}
        />
    </PickerHolder>
)

export const WithChoices = () => <SomeThingWithAPicker />

export const WithPickerMetricsChoices = () => (
    <SomeThingWithAPicker pickerSlugs={defaultSlugs} />
)

export const WithExistingSelectionChoices = () => (
    <SomeThingWithAPicker
        pickerSlugs={defaultSlugs}
        selection={["Japan", "Samoa"]}
    />
)
