import * as d3 from 'd3'
import * as _ from 'lodash'

declare const window: any

// This module handles exposing various libraries to the console
export default class Debug {
    static expose() {
        window.d3 = d3
        window._ = _
    }
}