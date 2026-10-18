import * as React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import a from "indefinite"
import {
    DataTableConfig,
    DataTableFilter,
} from "../dataTable/DataTableConstants"
import { SearchField } from "./SearchField"
import { DEFAULT_GRAPHER_ENTITY_TYPE } from "../core/GrapherConstants"
import { isAnyRegionPublisher } from "../core/RegionGroups"
import { match } from "ts-pattern"

export interface DataTableSearchFieldManager {
    dataTableConfig: DataTableConfig
    dataTableFilter: DataTableFilter
    isOnTableTab?: boolean
    isSemiNarrow?: boolean
    entityType?: string
}

@observer
export class DataTableSearchField extends React.Component<{
    manager: DataTableSearchFieldManager
}> {
    constructor(props: { manager: DataTableSearchFieldManager }) {
        super(props)
        makeObservable(this)
    }

    static shouldShow(manager: DataTableSearchFieldManager): boolean {
        const menu = new DataTableSearchField({ manager })
        return menu.shouldShow
    }

    @computed private get manager(): DataTableSearchFieldManager {
        return this.props.manager
    }

    @computed private get shouldShow(): boolean {
        return !!this.manager.isOnTableTab
    }

    @computed private get entityType(): string {
        return this.manager.entityType ?? DEFAULT_GRAPHER_ENTITY_TYPE
    }

    @computed private get placeholderEntityType(): string {
        const filter = this.manager.dataTableFilter
        if (isAnyRegionPublisher(filter)) return "region"

        return match(filter)
            .with("all", () => this.entityType)
            .with("selection", () => this.entityType)
            .with("countries", () => "country")
            .with("continents", () => "continent")
            .with("incomeGroups", () => "income group")
            .with("historicalCountries", () => "country or region")
            .exhaustive()
    }

    @computed private get placeholder(): string {
        if (this.manager.isSemiNarrow) return "Search..."
        return `Search for ${a(this.placeholderEntityType)}`
    }

    override render(): React.ReactElement | null {
        if (!this.shouldShow) return null

        return (
            <SearchField
                className="data-table-search-field"
                value={this.manager.dataTableConfig.search}
                onChange={(value) => {
                    // Reset filter to "all" when user starts typing
                    // to allow searching across all entities
                    if (value && this.manager.dataTableFilter !== "all") {
                        this.manager.dataTableConfig.filter = "all"
                    }
                    this.manager.dataTableConfig.search = value
                }}
                onClear={() => (this.manager.dataTableConfig.search = "")}
                trackNote="data_table_search"
                placeholder={this.placeholder}
            />
        )
    }
}
