import React from "react"
import { TimelineComponent } from "./TimelineComponent.js"
import { action, computed, observable, makeObservable } from "mobx";
import { range } from "../../clientUtils/Util.js"
import { TimelineController, TimelineManager } from "./TimelineController.js"

class TimelineManagerMock implements TimelineManager {
    isPlaying = false;
    userHasSetTimeline = true;
    times = range(1900, 2021);

    protected _endTime = 2020;

    constructor() {
        makeObservable<TimelineManagerMock, "_endTime" | "_startTime">(this, {
            isPlaying: observable,
            userHasSetTimeline: observable,
            times: observable,
            _endTime: observable,
            endHandleTimeBound: computed,
            updateEndTime: action.bound,
            _startTime: observable,
            startHandleTimeBound: computed,
            updateStartTime: action.bound,
            disablePlay: observable
        });
    }

    set endHandleTimeBound(num: number) {
        this.updateEndTime(num)
    }
    get endHandleTimeBound(): number {
        return this._endTime
    }

    updateEndTime(num: number): void {
        this._endTime = num
    }

    protected _startTime = 1950;
    set startHandleTimeBound(num: number) {
        this.updateStartTime(num)
    }
    get startHandleTimeBound(): number {
        return this._startTime
    }

    updateStartTime(num: number): void {
        this._startTime = num
    }

    disablePlay = false;
}

export default {
    title: "TimelineControl",
    component: TimelineComponent,
}

class SingleYearManager extends TimelineManagerMock {
    constructor() {
        // TODO: [mobx-undecorate] verify the constructor arguments and the arguments of this automatically generated super call
        super();

        makeObservable<SingleYearManager, "_endTime">(this, {
            updateEndTime: action.bound,
            updateStartTime: action.bound,
            _endTime: observable
        });
    }

    updateEndTime(num: number): void {
        // Simulate the Map class, which can only have 1 target time
        this._endTime = num
        this._startTime = num
    }
    updateStartTime(num: number): void {
        this._endTime = num
        this._startTime = num
    }
    protected _endTime = 1950;
}

export const Default = (): JSX.Element => {
    const manager = new TimelineManagerMock()
    manager.startHandleTimeBound = 1900
    const timelineController = new TimelineController(manager)
    return <TimelineComponent timelineController={timelineController} />
}

export const StartPartialRange = (): JSX.Element => (
    <TimelineComponent
        timelineController={new TimelineController(new TimelineManagerMock())}
    />
)

export const OneYearAtATime = (): JSX.Element => (
    <TimelineComponent
        timelineController={new TimelineController(new SingleYearManager())}
    />
)

export const DisablePlayButton = (): JSX.Element => {
    const manager = new TimelineManagerMock()
    manager.disablePlay = true
    return (
        <TimelineComponent
            timelineController={new TimelineController(manager)}
        />
    )
}
