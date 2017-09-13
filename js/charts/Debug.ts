import * as d3 from 'd3'

declare const window: any

// This module handles exposing various libraries to the console
export default class Debug {
    static expose() {
        window.d3 = d3
    }
}