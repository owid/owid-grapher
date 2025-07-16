import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Dropdown } from "./Dropdown"
import { EntityName } from "@ourworldindata/utils"
import { DataTableConfig } from "../dataTable/DataTableConstants"
import { OwidTable } from "@ourworldindata/core-table"
import { SelectionArray } from "../selection/SelectionArray"
import { makeSelectionArray } from "../chart/ChartUtils"
import {
    EntityRegionTypeGroup,
    entityRegionTypeLabels,
} from "../core/EntitiesByRegionType"

export interface DataTableFilterDropdownManager {
    dataTableConfig: DataTableConfig
    tableForDisplay: OwidTable
    isOnTableTab?: boolean
    dataTableSelection?: SelectionArray | EntityName[]
    canChangeAddOrHighlightEntities?: boolean
    shouldShowSelectionOnlyInDataTable?: boolean
    entityRegionTypeGroups?: EntityRegionTypeGroup[]
    isSemiNarrow?: boolean
}

interface DropdownOption {
    label: string
    value: DataTableConfig["filter"]
    count: number
    trackNote: "data_table_filter_by"
}

@observer
export class DataTableFilterDropdown extends React.Component<{
    manager: DataTableFilterDropdownManager
}> {
    constructor(props: { manager: DataTableFilterDropdownManager }) {
        super(props)
        makeObservable(this)
    }

    static shouldShow(manager: DataTableFilterDropdownManager): boolean {
        const menu = new DataTableFilterDropdown({ manager })
        return menu.shouldShow
    }

    @computed private get manager(): DataTableFilterDropdownManager {
        return this.props.manager
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.dataTableSelection)
    }

    @computed private get shouldShow(): boolean {
        return (
            !!this.manager.isOnTableTab &&
            this.options.length > 1 &&
            this.options[0].count !== this.options[1].count &&
            !this.manager.isSemiNarrow
        )
    }

    @computed private get availableEntityNameSet(): Set<EntityName> {
        return this.manager.tableForDisplay.availableEntityNameSet
    }

    @action.bound private onChange(selected: DropdownOption | null): void {
        if (selected?.value) {
            this.manager.dataTableConfig.filter = selected.value
            this.manager.dataTableConfig.search = ""
        }
    }

    @computed
    private get shouldShowSelectionOption(): boolean {
        return (
            !this.manager.shouldShowSelectionOnlyInDataTable &&
            this.selectionArray.hasSelection &&
            !!this.manager.canChangeAddOrHighlightEntities
        )
    }

    @computed private get options(): DropdownOption[] {
        const options: DropdownOption[] = [
            {
                value: "all",
                label: "All",
                count: this.availableEntityNameSet.size,
                trackNote: "data_table_filter_by",
            },
        ]

        if (this.shouldShowSelectionOption) {
            options.push({
                value: "selection",
                label: "Selection",
                count: this.selectionArray.numSelectedEntities,
                trackNote: "data_table_filter_by",
            })
        }

        if (this.manager.entityRegionTypeGroups) {
            options.push(
                ...this.manager.entityRegionTypeGroups
                    .map(
                        ({ regionType, entityNames }) =>
                            ({
                                value: regionType,
                                label: entityRegionTypeLabels[regionType],
                                count: entityNames.filter((entityName) =>
                                    this.availableEntityNameSet.has(entityName)
                                ).length,
                                trackNote: "data_table_filter_by",
                            }) satisfies DropdownOption
                    )
                    .filter(({ count }) => count > 0)
            )
        }

        return options
    }

    @computed private get value(): DropdownOption | null {
        const { filter } = this.props.manager.dataTableConfig
        return (
            this.options.find((option) => filter === option.value) ??
            this.options[0]
        )
    }

    render(): React.ReactElement | null {
        if (!this.shouldShow) return null

        return (
            <Dropdown<DropdownOption>
                className="data-table-filter-dropdown"
                options={this.options}
                onChange={this.onChange}
                value={this.value}
                formatOptionLabel={formatOptionLabel}
                aria-label="Filter by"
            />
        )
    }
}

function formatOptionLabel(option: DropdownOption): React.ReactElement {
    return (
        <>
            <span className="label">Filter by: </span>
            {option.label} <span className="detail">({option.count})</span>
        </>
    )
}
