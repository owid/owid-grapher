import * as React from "react"
import AsyncSelect from "react-select/async"
import { ValueType, SingleValueProps } from "react-select"
import { bind } from "decko"

import {
    ExplorerViewContext,
    ExplorerViewContextType
} from "./ExplorerViewContext"
import { observable, action, runInAction } from "mobx"
import { Indicator } from "./Indicator"
import { observer } from "mobx-react"

export interface IndicatorDropdownProps {
    placeholder: string
    selectedId?: number
    onChangeId: (id: number) => void
}

@observer
export class IndicatorDropdown extends React.Component<IndicatorDropdownProps> {
    static contextType = ExplorerViewContext
    context!: ExplorerViewContextType

    static defaultProps = {
        placeholder: "Type to search..."
    }

    @observable.ref currentIndicator?: Indicator | null

    componentDidMount() {
        this.loadCurrentIndicator()
    }

    componentDidUpdate() {
        this.loadCurrentIndicator()
    }

    // Since this component only takes IDs as parameters, we need to load the
    // full indicator in order to display the title.
    @action async loadCurrentIndicator() {
        if (
            this.props.selectedId &&
            this.props.selectedId !==
                (this.currentIndicator && this.currentIndicator.id)
        ) {
            const fetchedId = this.props.selectedId
            const indicator = await this.context.indicatorStore.get(
                this.props.selectedId
            )
            // this.props.selectedId could've changed during the await, need to
            // make a second check.
            if (fetchedId === this.props.selectedId) {
                runInAction(() => {
                    this.currentIndicator = indicator
                })
            }
        } else if (!this.props.selectedId) {
            this.currentIndicator = null
        }
    }

    @bind onChange(indicator: ValueType<Indicator>) {
        // The onChange method can return an array of values (when multiple
        // items can be selected) or a single value. Since we are certain that
        // we are not using the multi-option select we can force the type to be
        // a single value.
        this.props.onChangeId((indicator as Indicator).id)
    }

    @bind async loadOptions(input: string): Promise<Indicator[]> {
        return await this.context.indicatorStore.search({
            query: input
        })
    }

    @bind getValue(indicator: Indicator) {
        return indicator.id
    }

    @bind getLabel(indicator: Indicator) {
        if (indicator.sourceDesc) {
            return `${indicator.title}, ${indicator.sourceDesc}`
        } else {
            return indicator.title
        }
    }

    render() {
        return (
            <AsyncSelect
                className="indicator-dropdown"
                onChange={this.onChange}
                placeholder={this.props.placeholder}
                defaultOptions={true}
                loadOptions={this.loadOptions as any}
                getOptionValue={this.getValue as any}
                getOptionLabel={this.getLabel as any}
                value={this.currentIndicator}
            />
        )
    }
}

export class SingleValue extends React.Component<SingleValueProps<Indicator>> {
    static contextType = ExplorerViewContext
    context!: ExplorerViewContextType

    @observable.ref indicator?: Indicator | null

    componentDidMount() {
        if (!this.props.data.title) {
            this.fetchIndicator()
        }
    }

    async fetchIndicator() {
        const id = this.props.data.id
        this.indicator = await this.context.indicatorStore.get(id)
        console.log(this.indicator)
    }

    get title(): string {
        return (this.indicator && this.indicator.title) || ""
    }

    render() {
        const { className, innerProps } = this.props
        return this.title
    }
}
