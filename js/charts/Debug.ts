declare const window: any

import Bounds from './Bounds'
import ColorSchemes from './ColorSchemes'
const colorbrewer = require('colorbrewer')

// This module handles exposing various libraries to the console
export default class Debug {
    static expose() {
        window.Bounds = Bounds
        window.ColorSchemes = ColorSchemes
        window.colorbrewer = colorbrewer
    }
}