import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Dropdown } from "./Dropdown"
import {
    DataTableConfig,
    DataTableFilter,
    DataTableFilterOption,
} from "../dataTable/DataTableConstants"
import { hasDataTableFilterChoice } from "../dataTable/DataTableHelpers"
import { regionGroupLabels } from "../core/RegionGroups"

const FILTER_LABELS: Record<DataTableFilter, string> = {
    all: "All",
    selection: "Selection",
    ...regionGroupLabels,
}

export interface DataTableFilterDropdownManager {
    dataTableConfig: DataTableConfig
    dataTableFilter: DataTableFilter
    dataTableFilterOptions: DataTableFilterOption[]
    isOnTableTab?: boolean
}

interface DropdownOption extends DataTableFilterOption {
    label: string
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

    @computed private get shouldShow(): boolean {
        return (
            !!this.manager.isOnTableTab &&
            hasDataTableFilterChoice(this.manager.dataTableFilterOptions)
        )
    }

    @action.bound private onChange(selected: DropdownOption | null): void {
        if (selected?.value) {
            this.manager.dataTableConfig.filter = selected.value
            this.manager.dataTableConfig.search = ""
        }
    }

    @computed private get options(): DropdownOption[] {
        return this.manager.dataTableFilterOptions.map((option) => ({
            ...option,
            label: FILTER_LABELS[option.value],
            trackNote: "data_table_filter_by",
        }))
    }

    @computed private get value(): DropdownOption | null {
        const filter = this.props.manager.dataTableFilter
        return (
            this.options.find((option) => filter === option.value) ??
            this.options[0]
        )
    }

    override render(): React.ReactElement | null {
        if (!this.shouldShow) return null

        return (
            <Dropdown<DropdownOption>
                className="data-table-filter-dropdown"
                menuClassName="data-table-filter-dropdown-menu"
                options={this.options}
                onChange={this.onChange}
                value={this.value}
                renderTriggerValue={renderFilterTriggerValue}
                renderMenuOption={renderFilterMenuOption}
                aria-label="Filter by"
            />
        )
    }
}

function renderFilterTriggerValue(
    option: DropdownOption | null
): React.ReactNode | undefined {
    if (!option) return undefined
    return (
        <>
            <span className="label">Filter by: </span>
            {option.label} <span className="detail">({option.count})</span>
        </>
    )
}

function renderFilterMenuOption(option: DropdownOption): React.ReactNode {
    return (
        <>
            {option.label} <span className="detail">({option.count})</span>
        </>
    )
}
