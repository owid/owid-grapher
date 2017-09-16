declare const window: any

import Bounds from './Bounds'

// This module handles exposing various libraries to the console
export default class Debug {
    static expose() {
        window.Bounds = Bounds
    }
}