import React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { FacetAxisDomain, FacetStrategy } from "../../core/GrapherConstants"
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
        this.props.manager.yAxis!.facetDomain = this.isYDomainShared
            ? FacetAxisDomain.independent
            : FacetAxisDomain.shared
    }

    @computed get isYDomainShared(): boolean {
        const facetDomain =
            this.props.manager.yAxis!.facetDomain || FacetAxisDomain.shared
        return facetDomain === FacetAxisDomain.shared
    }

    render(): JSX.Element | null {
        if (this.props.manager.facetStrategy === "none") return null
        return (
            <LabeledSwitch
                label="Align axis scales"
                tooltip="Use the same minimum and maximum values on all charts or scale axes to fit the data in each chart"
                value={this.isYDomainShared}
                onToggle={this.onToggle}
            />
        )
    }
}
