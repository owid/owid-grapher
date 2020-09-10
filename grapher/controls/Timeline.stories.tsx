import * as React from "react"
import {
    TimelineControl,
    TimelineProps,
} from "grapher/controls/TimelineControl"
import { observable, computed } from "mobx"
import { range } from "grapher/utils/Util"
import { observer } from "mobx-react"

@observer
class ComponentWithTimeline extends React.Component<{
    startYear: number
    endYear: number
    minYear: number
    maxYear: number
    skipYears: boolean // To simulate a spare dataset
    singleYearMode: boolean
}> {
    @observable isPlaying = false
    userHasSetTimeline = false
    @observable startYear = this.props.startYear
    @observable endYear = this.props.endYear

    @computed get years() {
        return range(this.props.minYear, this.props.maxYear).filter((year) =>
            this.props.skipYears ? year % 3 : true
        )
    }

    render() {
        const singleYearMode = this.props.singleYearMode ?? false
        const props: TimelineProps = {
            singleYearMode,
            subject: this,
        }
        return <TimelineControl {...props} />
    }
}

const control = { type: "range", min: -1000, max: 2100 }

export default {
    title: "TimelineControl",
    component: ComponentWithTimeline,
    argTypes: {
        singleYearMode: { defaultValue: false, control: { type: "boolean" } },
        minYear: {
            defaultValue: 1950,
            control,
        },
        startYear: { defaultValue: 1950, control },
        endYear: { defaultValue: 2020, control },
        maxYear: {
            defaultValue: 2020,
            control,
        },
    },
}

export const Default = (args: any) => <ComponentWithTimeline {...args} />
