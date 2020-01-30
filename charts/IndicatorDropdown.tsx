import * as React from "react"
import { ValueType } from "react-select"
import { bind } from "decko"

import {
    ExplorerViewContext,
    ExplorerViewContextType
} from "./ExplorerViewContext"
import { Indicator } from "./Indicator"
import { observer } from "mobx-react"
import { StoreEntry } from "./Store"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronDown } from "@fortawesome/free-solid-svg-icons/faChevronDown"

export interface IndicatorDropdownProps {
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
        // The onChange method can return an array of values (when multiple
        // items can be selected) or a single value. Since we are certain that
        // we are not using the multi-option select we can force the type to be
        // a single value.
        this.props.onChangeId((indicator as Indicator).id)
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
        // return (
        //     <AsyncSelect
        //         className="indicator-dropdown"
        //         onChange={this.onChange}
        //         placeholder={this.props.placeholder}
        //         defaultOptions={true}
        //         loadOptions={this.loadOptions}
        //         getOptionValue={this.getValue}
        //         getOptionLabel={this.getLabel}
        //         value={entity}
        //     />
        // )
        if (!entity) {
            return "Loading..."
        } else {
            return (
                <div className="indicator-dropdown">
                    <div className="indicator-current">
                        <div className="indicator-info">
                            <h1 className="indicator-title">{entity.title}</h1>
                            <div className="indicator-metadata">
                                {entity.sourceDesc}
                            </div>
                        </div>
                        <span className="icon">
                            <FontAwesomeIcon icon={faChevronDown} />
                        </span>
                    </div>
                </div>
            )
        }
    }
}
