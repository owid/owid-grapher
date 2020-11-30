import * as React from "react"
import { TimelineComponent } from "./TimelineComponent"
import { action, computed, observable } from "mobx"
import { range } from "clientUtils/Util"
import { TimelineController, TimelineManager } from "./TimelineController"

class TimelineManagerMock implements TimelineManager {
    @observable isPlaying = false
    @observable userHasSetTimeline = true
    @observable times = range(1900, 2021)

    @observable protected _endTime = 2020
    set endHandleTimeBound(num: number) {
        this.updateEndTime(num)
    }
    @computed get endHandleTimeBound() {
        return this._endTime
    }

    @action.bound updateEndTime(num: number) {
        this._endTime = num
    }

    @observable protected _startTime = 1950
    set startHandleTimeBound(num: number) {
        this.updateStartTime(num)
    }
    @computed get startHandleTimeBound() {
        return this._startTime
    }

    @action.bound updateStartTime(num: number) {
        this._startTime = num
    }

    @observable disablePlay = false
}

export default {
    title: "TimelineControl",
    component: TimelineComponent,
}

class SingleYearManager extends TimelineManagerMock {
    @action.bound updateEndTime(num: number) {
        // Simulate the Map class, which can only have 1 target time
        this._endTime = num
        this._startTime = num
    }
    @action.bound updateStartTime(num: number) {
        this._endTime = num
        this._startTime = num
    }
    @observable protected _endTime = 1950
}

export const Default = () => {
    const manager = new TimelineManagerMock()
    manager.startHandleTimeBound = 1900
    const timelineController = new TimelineController(manager)
    return <TimelineComponent timelineController={timelineController} />
}

export const StartPartialRange = () => (
    <TimelineComponent
        timelineController={new TimelineController(new TimelineManagerMock())}
    />
)

export const OneYearAtATime = () => (
    <TimelineComponent
        timelineController={new TimelineController(new SingleYearManager())}
    />
)

export const DisablePlayButton = () => {
    const manager = new TimelineManagerMock()
    manager.disablePlay = true
    return (
        <TimelineComponent
            timelineController={new TimelineController(manager)}
        />
    )
}
