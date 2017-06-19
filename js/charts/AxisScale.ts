/* AxisScale.ts
 * ================
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-11
 */

import * as d3 from 'd3'
import * as _ from 'lodash'
import {observable, computed, action, toJS} from 'mobx'

export type ScaleType = 'linear' | 'log';

export interface AxisConfig {
    scaleType: ScaleType,
    scaleTypeOptions: ScaleType[],
    tickFormat: (v: number) => string,
    domain: [number, number],
    label: string
}

export default class AxisScale {
    @observable scaleType: ScaleType
    @observable.struct scaleTypeOptions: ScaleType[]
    @observable tickFormat : (v: number) => string
    @observable.struct domain: [number, number]
    @observable.struct range: [number, number]

    @computed get d3_scaleConstructor(): Function {
        return this.scaleType == 'log' ? d3.scaleLog : d3.scaleLinear
    }

    @computed get d3_scale(): d3.ScaleLinear<number, number> | d3.ScaleLogarithmic<number, number> {
        return this.d3_scaleConstructor().domain(this.domain).range(this.range)
    }

    getTickValues() {
        const {scaleType, domain, d3_scale} = this        

        if (scaleType == 'log') {
            let minPower10 = Math.ceil(Math.log(domain[0]) / Math.log(10));
            if (!_.isFinite(minPower10)) minPower10 = 0
            let maxPower10 = Math.floor(Math.log(domain[1]) / Math.log(10));
            if (maxPower10 <= minPower10) maxPower10 += 1

            var tickValues = [];
            for (var i = minPower10; i <= maxPower10; i++) {
                tickValues.push(Math.pow(10, i));
            }
            return tickValues
        } else {
            return d3_scale.ticks(6)
        }
    }

    getFormattedTicks() : string[] {
        return _.map(this.getTickValues(), this.tickFormat)
    }

    place(value: number) {
        if (!this.range)
            throw "Can't place value on scale without a defined output range"
        else if (this.scaleType == 'log' && value <= 0)
            throw "Can't have values <= 0 on a log scale"
        return this.d3_scale(value)
    }

    extend(props : Object) {
        return new AxisScale(_.extend(toJS(this), props))
    }

    constructor({ scaleType = 'linear', 
                  scaleTypeOptions = ['linear'],
                  tickFormat = (d => d.toString()), 
                  domain = [0, 0], 
                  range = [0, 0] } :
                { scaleType: ScaleType, scaleTypeOptions: ScaleType[],
                  tickFormat: (v: number) => string, domain: [number, number], range?: [number, number] }) {
        this.scaleType = scaleType
        this.scaleTypeOptions = scaleTypeOptions
        this.tickFormat = tickFormat
        this.domain = domain
        this.range = range
    }
}
