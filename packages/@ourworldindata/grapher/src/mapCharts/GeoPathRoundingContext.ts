import { GeoContext } from "d3-geo"

// Can be used as a d3 projection context to convert a geojson feature to a SVG path
// In contrast to what d3-geo does by default, it will round all coordinates to one decimal place
// Adapted from https://github.com/d3/d3-geo/blob/8d3f3a98c034b087e2c808f752d2381d51c30015/src/path/string.js

export class GeoPathRoundingContext implements GeoContext {
    _string: string[] = []

    beginPath(): void {
        this._string = []
    }

    moveTo(x: number, y: number): void {
        this._string.push("M" + x.toFixed(1) + "," + y.toFixed(1))
    }

    lineTo(x: number, y: number): void {
        this._string.push("L" + x.toFixed(1) + "," + y.toFixed(1))
    }

    arc(_x: number, _y: number, _radius: number): void {
        throw new Error("Method not implemented.")
    }

    closePath(): void {
        this._string.push("Z")
    }

    result(): string {
        return this._string.join("")
    }
}
