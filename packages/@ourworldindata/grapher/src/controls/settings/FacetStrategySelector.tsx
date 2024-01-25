import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { DEFAULT_GRAPHER_ENTITY_TYPE } from "../../core/GrapherConstants"
import { range, FacetStrategy } from "@ourworldindata/utils"
import classnames from "classnames"

export interface FacetStrategySelectionManager {
    availableFacetStrategies: FacetStrategy[]
    facetStrategy?: FacetStrategy
    entityType?: string
    facettingLabelByYVariables?: string
}

@observer
export class FacetStrategySelector extends React.Component<{
    manager: FacetStrategySelectionManager
}> {
    @computed get facetStrategyLabels(): { [key in FacetStrategy]: string } {
        return {
            [FacetStrategy.none]: "All together",
            [FacetStrategy.entity]: `Split by ${this.entityName}`,
            [FacetStrategy.metric]: `Split by ${this.metricName}`,
        }
    }

    @computed get entityName(): string {
        return this.props.manager.entityType ?? DEFAULT_GRAPHER_ENTITY_TYPE
    }

    @computed get metricName(): string {
        return this.props.manager.facettingLabelByYVariables ?? "metric"
    }

    @computed get strategies(): FacetStrategy[] {
        return (
            this.props.manager.availableFacetStrategies || [
                FacetStrategy.none,
                FacetStrategy.entity,
                FacetStrategy.metric,
            ]
        )
    }

    @computed get subtitle(): string {
        const entityChoice = this.entityName.replace(/ or /, "/"),
            byEntity = this.strategies.includes(FacetStrategy.entity),
            byMetric = this.strategies.includes(FacetStrategy.metric)

        if (byEntity || byMetric) {
            const facet =
                byEntity && byMetric
                    ? `${this.metricName} or ${entityChoice}`
                    : byEntity
                    ? this.entityName
                    : this.metricName
            return (
                "Visualize the data all together in one chart or split it by " +
                facet
            )
        } else {
            return ""
        }
    }

    render(): JSX.Element {
        return (
            <>
                <div className="config-subtitle">{this.subtitle}</div>
                <div className="config-list">
                    {this.strategies.map((value: FacetStrategy) => {
                        const label = this.facetStrategyLabels[value],
                            active = value === this.facetStrategy,
                            option = value.toString()

                        return (
                            <button
                                key={option}
                                className={classnames(option, { active })}
                                onClick={(): void => {
                                    this.props.manager.facetStrategy = value
                                }}
                                data-track-note={`chart_facet_${option}`}
                            >
                                <div className="faceting-icon">
                                    {range(value === "none" ? 1 : 6).map(
                                        (i) => (
                                            <span key={i}></span>
                                        )
                                    )}
                                </div>
                                {label}
                            </button>
                        )
                    })}
                </div>
            </>
        )
    }

    @computed get facetStrategy(): FacetStrategy {
        return this.props.manager.facetStrategy || FacetStrategy.none
    }
}
