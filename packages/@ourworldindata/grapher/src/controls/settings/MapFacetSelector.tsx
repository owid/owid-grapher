import * as React from "react"
import { observer } from "mobx-react"
import {
    findClosestTime,
    range,
    Time,
    TimeBound,
    TimeBounds,
} from "@ourworldindata/utils"
import classnames from "classnames"

export interface MapFacetSelectorManager {
    isFaceted?: boolean
    timelineHandleTimeBounds?: TimeBounds
    startTime?: Time
    endTime?: Time
    startHandleTimeBound?: TimeBound
    endHandleTimeBound?: TimeBound
    times?: Time[]
}

@observer
export class MapFacetSelector extends React.Component<{
    manager: MapFacetSelectorManager
}> {
    render(): React.ReactElement {
        return (
            <>
                <div className="config-subtitle">Explanation</div>
                <div className="config-list">
                    <button
                        className={classnames("none", {
                            active: !this.props.manager.isFaceted,
                        })}
                        onClick={(): void => {
                            this.props.manager.timelineHandleTimeBounds = [
                                this.props.manager.endTime ?? Infinity,
                                this.props.manager.endTime ?? Infinity,
                            ]
                        }}
                        // data-track-note={`chart_facet_${option}`}
                    >
                        <div className="faceting-icon">
                            {range(1).map((i) => (
                                <span key={i}></span>
                            ))}
                        </div>
                        Single year
                    </button>
                    <button
                        className={classnames("entity", {
                            active: this.props.manager.isFaceted,
                        })}
                        onClick={(): void => {
                            const newStartTime = findClosestTime(
                                this.props.manager.times ?? [],
                                -Infinity
                            )

                            if (
                                newStartTime &&
                                newStartTime !== this.props.manager.endTime
                            ) {
                                this.props.manager.timelineHandleTimeBounds = [
                                    newStartTime,
                                    this.props.manager.endTime ?? Infinity,
                                ]
                            } else {
                                this.props.manager.timelineHandleTimeBounds = [
                                    this.props.manager.startHandleTimeBound ??
                                        -Infinity,
                                    Infinity,
                                ]
                            }
                        }}
                        // data-track-note={`chart_facet_${option}`}
                    >
                        <div className="faceting-icon">
                            {range(6).map((i) => (
                                <span key={i}></span>
                            ))}
                        </div>
                        Compare years
                    </button>
                </div>
            </>
        )
    }
}
