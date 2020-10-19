import * as React from "react"
import { TimelineComponent } from "./TimelineComponent"
import { action, computed, observable } from "mobx"
import { range } from "grapher/utils/Util"

class Subject {
    @observable isPlaying = false
    @observable userHasSetTimeline = true
    @observable times = range(1900, 2021)

    @observable protected _endTime = 2020
    set endTime(num: number) {
        this.updateEndTime(num)
    }
    @computed get endTime() {
        return this._endTime
    }

    @action.bound updateEndTime(num: number) {
        this._endTime = num
    }

    @observable protected _startTime = 1950
    set startTime(num: number) {
        this.updateStartTime(num)
    }
    @computed get startTime() {
        return this._startTime
    }

    @action.bound updateStartTime(num: number) {
        this._startTime = num
    }
}

export default {
    title: "TimelineControl",
    component: TimelineComponent,
}

class SingleYearSubject extends Subject {
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
    const subject = new Subject()
    subject.startTime = 1900
    return <TimelineComponent target={subject} />
}

export const StartPartialRange = () => {
    return <TimelineComponent target={new Subject()} />
}

export const OneYearAtATime = () => {
    const subject = new SingleYearSubject()
    return <TimelineComponent target={subject} />
}

export const DisablePlayButton = () => {
    const subject = new Subject()
    return <TimelineComponent target={subject} disablePlay={true} />
}
