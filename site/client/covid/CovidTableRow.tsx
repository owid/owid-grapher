import * as React from "react"
import { observable, computed } from "mobx"
import { observer } from "mobx-react"
import { bind } from "decko"

import { dateDiffInDays, addDays } from "charts/Util"

import { CovidCountryDatum, DateRange, CovidDatum } from "./CovidTypes"
import { CovidTableState } from "./CovidTable"
import {
    CovidTableColumnKey,
    columns,
    CovidTableCellSpec
} from "./CovidTableColumns"

export interface CovidTableRowProps {
    columns: CovidTableColumnKey[]
    datum: CovidCountryDatum
    dateRange: DateRange
    state: CovidTableState
    onHighlightDate: (date: Date | undefined) => void
}

@observer
export class CovidTableRow extends React.Component<CovidTableRowProps> {
    static defaultProps = {
        onHighlightDate: () => undefined
    }

    @observable.ref highlightDate: Date | undefined = undefined

    @computed get data() {
        const d = this.props.datum
        const [start, end] = this.props.dateRange
        return d.series.filter(d => d.date >= start && d.date <= end)
    }

    @bind dateToIndex(date: Date): number {
        return dateDiffInDays(date, this.props.dateRange[0])
    }

    @bind dateFromIndex(index: number): Date {
        return addDays(this.props.dateRange[0], index)
    }

    @computed get xDomain(): [number, number] {
        const [start, end] = this.props.dateRange
        return [0, dateDiffInDays(end, start)]
    }

    @computed get currentX(): number | undefined {
        const { datum } = this.props
        if (datum.latest) {
            return this.x(datum.latest)
        }
        return undefined
    }

    @computed get hightlightedX(): number | undefined {
        const { state } = this.props
        if (!state.isMobile && this.highlightDate) {
            return this.dateToIndex(this.highlightDate)
        }
        return undefined
    }

    @bind x(d: CovidDatum): number {
        return this.dateToIndex(d.date)
    }

    @bind onBarHover(d: CovidDatum | undefined, i: number | undefined) {
        let date
        if (d !== undefined) {
            date = d.date
        } else if (i !== undefined) {
            date = this.dateFromIndex(i)
        } else {
            date = undefined
        }
        this.highlightDate = date
    }

    @computed get cellProps(): CovidTableCellSpec {
        return {
            datum: this.props.datum,
            isMobile: this.props.state.isMobile,
            bars: {
                data: this.data,
                xDomain: this.xDomain,
                x: this.x,
                currentX: this.currentX,
                highlightedX: this.hightlightedX,
                onHover: this.onBarHover
            }
        }
    }

    render() {
        return (
            <tr>
                {this.props.columns.map(key => (
                    <React.Fragment key={key}>
                        {columns[key].cell(this.cellProps)}
                    </React.Fragment>
                ))}
            </tr>
        )
    }
}
