import React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { FacetAxisDomain, FacetStrategy } from "@ourworldindata/types"
import { AxisConfig } from "../../axis/AxisConfig"
import { LabeledSwitch } from "../LabeledSwitch"

export interface FacetYDomainToggleManager {
    facetStrategy?: FacetStrategy
    yAxis?: AxisConfig
}

@observer
export class FacetYDomainToggle extends React.Component<{
    manager: FacetYDomainToggleManager
}> {
    @action.bound onToggle(): void {
        const { yAxis } = this.props.manager
        if (yAxis) {
            yAxis.facetDomain = this.isYDomainShared
                ? FacetAxisDomain.independent
                : FacetAxisDomain.shared
        }
    }

    @computed get isYDomainShared(): boolean {
        const { yAxis } = this.props.manager
        const facetDomain = yAxis?.facetDomain || FacetAxisDomain.shared
        return facetDomain === FacetAxisDomain.shared
    }

    render(): JSX.Element | null {
        const { yAxis, facetStrategy } = this.props.manager
        if (!yAxis || facetStrategy === "none") return null

        return (
            <LabeledSwitch
                label="Align axis scales"
                tooltip="Use the same minimum and maximum values on all charts or scale axes to fit the data in each chart"
                value={this.isYDomainShared}
                onToggle={this.onToggle}
                tracking="chart_facet_ydomain_toggle"
            />
        )
    }
}
