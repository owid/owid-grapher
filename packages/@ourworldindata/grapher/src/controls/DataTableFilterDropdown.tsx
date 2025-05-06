import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { Dropdown } from "./Dropdown"
import { DEFAULT_BOUNDS, EntityName } from "@ourworldindata/utils"
import { DataTableConfig } from "../dataTable/DataTable"
import { OwidTable } from "@ourworldindata/core-table"
import { SelectionArray } from "../selection/SelectionArray"
import { makeSelectionArray } from "../chart/ChartUtils"

export interface DataTableFilterDropdownManager {
    dataTableConfig: DataTableConfig
    tableForDisplay: OwidTable
    isOnTableTab?: boolean
    dataTableSelection?: SelectionArray | EntityName[]
    canChangeAddOrHighlightEntities?: boolean
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
    maxWidth?: number
}> {
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
            this.options[0].count !== this.options[1].count
        )
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @action.bound private onChange(selected: DropdownOption | null): void {
        if (selected?.value) {
            this.manager.dataTableConfig.filter = selected.value
        }
    }

    @computed
    private get shouldShowSelectionOption(): boolean {
        return (
            this.selectionArray.hasSelection &&
            !!this.manager.canChangeAddOrHighlightEntities
        )
    }

    @computed private get options(): DropdownOption[] {
        const options: DropdownOption[] = [
            {
                value: "all",
                label: "All",
                count: this.manager.tableForDisplay.availableEntityNameSet.size,
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

        return options
    }

    @computed private get value(): DropdownOption | null {
        const { filter } = this.props.manager.dataTableConfig
        return this.options.find((option) => filter === option.value) ?? null
    }

    render(): React.ReactElement | null {
        if (!this.shouldShow) return null

        return (
            <div
                className="data-table-filter-dropdown"
                style={{ maxWidth: this.maxWidth }}
            >
                <Dropdown<DropdownOption>
                    options={this.options}
                    onChange={this.onChange}
                    value={this.value}
                    formatOptionLabel={formatOptionLabel}
                    aria-label="Filter by"
                />
            </div>
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
