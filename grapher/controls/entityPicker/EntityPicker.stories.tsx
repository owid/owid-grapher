import * as React from "react"
import { EntityPicker } from "./EntityPicker"
import { observer } from "mobx-react"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "../../../coreTable/OwidTableSynthesizers"
import { ColumnSlug, SortOrder } from "../../../coreTable/CoreTableConstants"
import {
    EntityName,
    OwidTableSlugs,
} from "../../../coreTable/OwidTableConstants"
import { EntityPickerManager } from "./EntityPickerConstants"
import { computed, observable } from "mobx"
import { SelectionArray } from "../../selection/SelectionArray"

class PickerHolder extends React.Component {
    render(): JSX.Element {
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

    @computed get pickerColumnSlugs(): string[] | undefined {
        return this.props.pickerSlugs
    }

    selection = new SelectionArray(
        this.props.selection ?? [],
        this.entityPickerTable.availableEntities
    )

    requiredColumnSlugs = defaultSlugs

    render(): JSX.Element {
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

export const Empty = (): JSX.Element => (
    <PickerHolder>
        <EntityPicker
            manager={{
                selection: new SelectionArray(),
            }}
        />
    </PickerHolder>
)

export const WithChoices = (): JSX.Element => <SomeThingWithAPicker />

export const WithPickerMetricsChoices = (): JSX.Element => (
    <SomeThingWithAPicker pickerSlugs={defaultSlugs} />
)

export const WithExistingSelectionChoices = (): JSX.Element => (
    <SomeThingWithAPicker
        pickerSlugs={defaultSlugs}
        selection={["Japan", "Samoa"]}
    />
)
