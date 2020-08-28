import * as React from "react"
import AsyncSelect from "react-select/async"
import { ValueType } from "react-select"
import { bind } from "decko"

import {
    ExplorerViewContext,
    ExplorerViewContextType
} from "./ExplorerViewContext"
import { Indicator } from "./Indicator"
import { observer } from "mobx-react"
import { StoreEntry } from "./Store"
import { asArray } from "utils/client/react-select"
import { first } from "charts/utils/Util"

interface IndicatorDropdownProps {
    placeholder: string
    indicatorEntry: StoreEntry<Indicator> | null
    onChangeId: (id: number) => void
}

@observer
export class IndicatorDropdown extends React.Component<IndicatorDropdownProps> {
    static contextType = ExplorerViewContext
    context!: ExplorerViewContextType

    static defaultProps = {
        placeholder: "Type to search..."
    }

    @bind onChange(indicator: ValueType<Indicator>) {
        const value = first(asArray(indicator))?.id
        if (value) this.props.onChangeId(value)
    }

    @bind async loadOptions(query: string): Promise<Indicator[]> {
        const entries = await this.context.store.indicators.search({
            query
        })
        return entries.map(entry => entry.entity) as Indicator[]
    }

    @bind getValue(indicator: Indicator): string {
        return `${indicator.id}`
    }

    @bind getLabel(indicator: Indicator): string {
        if (indicator.sourceDesc) {
            return `${indicator.title}, ${indicator.sourceDesc}`
        } else {
            return indicator.title || ""
        }
    }

    render() {
        const entry = this.props.indicatorEntry
        const entity = entry && entry.entity
        return (
            <AsyncSelect
                className="indicator-dropdown"
                onChange={this.onChange}
                placeholder={this.props.placeholder}
                defaultOptions={true}
                loadOptions={this.loadOptions}
                getOptionValue={this.getValue}
                getOptionLabel={this.getLabel}
                value={entity}
            />
        )
    }
}
