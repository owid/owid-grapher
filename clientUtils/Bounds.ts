import { makeGrid, range } from "./Util"
import { PointVector } from "./PointVector"
import pixelWidth from "string-pixel-width"
import { Box } from "./owidTypes"

// Important utility class for all visualizations
// Since we want to be able to render charts headlessly and functionally, we
// can't rely on the DOM to do these calculations for us, and instead must
// calculate using geometry and first principles
export class Bounds {
    static textBoundsCache: { [key: string]: Bounds } = {}
    static ctx: CanvasRenderingContext2D

    static fromProps(props: Box) {
        const { x, y, width, height } = props
        return new Bounds(x, y, width, height)
    }

    static fromBBox(bbox: Box) {
        return this.fromProps(bbox)
    }

    static fromRect(rect: ClientRect) {
        return new Bounds(rect.left, rect.top, rect.width, rect.height)
    }

    static fromElement(el: HTMLElement) {
        return Bounds.fromRect(el.getBoundingClientRect())
    }

    static fromCorners(p1: PointVector, p2: PointVector) {
        const x1 = Math.min(p1.x, p2.x)
        const x2 = Math.max(p1.x, p2.x)
        const y1 = Math.min(p1.y, p2.y)
        const y2 = Math.max(p1.y, p2.y)

        return new Bounds(x1, y1, x2 - x1, y2 - y1)
    }

    // Merge a collection of bounding boxes into a single encompassing Bounds
    static merge(boundsList: Bounds[]) {
        let x1 = Infinity,
            y1 = Infinity,
            x2 = -Infinity,
            y2 = -Infinity
        for (const b of boundsList) {
            x1 = Math.min(x1, b.x)
            y1 = Math.min(y1, b.y)
            x2 = Math.max(x2, b.x + b.width)
            y2 = Math.max(y2, b.y + b.height)
        }
        return Bounds.fromCorners(
            new PointVector(x1, y1),
            new PointVector(x2, y2)
        )
    }

    static getRightShiftForMiddleAlignedTextIfNeeded(
        label: string,
        fontSize: number,
        xPosition: number
    ) {
        const bounds = Bounds.forText(label, {
            fontSize,
        })
        const overflow = xPosition - Math.ceil(bounds.width / 2)
        return overflow < 0 ? Math.abs(overflow) : 0
    }

    static empty() {
        return new Bounds(0, 0, 0, 0)
    }

    static forText(
        str: string = "",
        {
            x = 0,
            y = 0,
            fontSize = 16,
            fontWeight = 400,
        }: {
            x?: number
            y?: number
            fontSize?: number
            fontWeight?: number
            fontFamily?: string
        } = {}
    ) {
        // Collapse contiguous spaces into one
        str = str.replace(/ +/g, " ")
        const key = `${str}-${fontSize}`
        let bounds = this.textBoundsCache[key]
        if (bounds) {
            if (bounds.x === x && bounds.y === y - bounds.height) return bounds
            return bounds.extend({ x: x, y: y - bounds.height })
        }

        if (str === "") bounds = Bounds.empty()
        else {
            const width = pixelWidth(str, {
                font: "arial",
                size: fontSize,
                bold: fontWeight >= 600,
            })
            const height = fontSize
            bounds = new Bounds(x, y - height, width, height)
        }

        this.textBoundsCache[key] = bounds
        return bounds
    }

    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number

    constructor(x: number, y: number, width: number, height: number) {
        this.x = x
        this.y = y
        this.width = Math.max(width, 0)
        this.height = Math.max(height, 0)
    }

    get left() {
        return this.x
    }
    get top() {
        return this.y
    }
    get right() {
        return this.x + this.width
    }
    get bottom() {
        return this.y + this.height
    }
    get centerX() {
        return this.x + this.width / 2
    }
    get centerY() {
        return this.y + this.height / 2
    }
    get centerPos() {
        return new PointVector(this.centerX, this.centerY)
    }
    get area() {
        return this.width * this.height
    }

    get topLeft() {
        return new PointVector(this.left, this.top)
    }
    get topRight() {
        return new PointVector(this.right, this.top)
    }
    get bottomLeft() {
        return new PointVector(this.left, this.bottom)
    }
    get bottomRight() {
        return new PointVector(this.right, this.bottom)
    }

    padLeft(amount: number) {
        return new Bounds(
            this.x + amount,
            this.y,
            this.width - amount,
            this.height
        )
    }

    padRight(amount: number) {
        return new Bounds(this.x, this.y, this.width - amount, this.height)
    }

    padBottom(amount: number) {
        return new Bounds(this.x, this.y, this.width, this.height - amount)
    }

    padTop(amount: number) {
        return new Bounds(
            this.x,
            this.y + amount,
            this.width,
            this.height - amount
        )
    }

    padWidth(amount: number) {
        return new Bounds(
            this.x + amount,
            this.y,
            this.width - amount * 2,
            this.height
        )
    }

    padHeight(amount: number) {
        return new Bounds(
            this.x,
            this.y + amount,
            this.width,
            this.height - amount * 2
        )
    }

    fromLeft(amount: number) {
        return this.padRight(this.width - amount)
    }

    fromBottom(amount: number) {
        return this.padTop(this.height - amount)
    }

    pad(amount: number) {
        return new Bounds(
            this.x + amount,
            this.y + amount,
            this.width - amount * 2,
            this.height - amount * 2
        )
    }

    extend(props: { x?: number; y?: number; width?: number; height?: number }) {
        return Bounds.fromProps({ ...this, ...props })
    }

    scale(scale: number) {
        return new Bounds(
            this.x * scale,
            this.y * scale,
            this.width * scale,
            this.height * scale
        )
    }

    intersects(otherBounds: Bounds) {
        const r1 = this
        const r2 = otherBounds

        return !(
            r2.left > r1.right ||
            r2.right < r1.left ||
            r2.top > r1.bottom ||
            r2.bottom < r1.top
        )
    }

    lines(): PointVector[][] {
        return [
            [this.topLeft, this.topRight],
            [this.topRight, this.bottomRight],
            [this.bottomRight, this.bottomLeft],
            [this.bottomLeft, this.topLeft],
        ]
    }

    boundedPoint(p: PointVector) {
        return new PointVector(
            Math.max(Math.min(p.x, this.right), this.left),
            Math.max(Math.min(p.y, this.bottom), this.top)
        )
    }

    containsPoint(x: number, y: number) {
        return (
            x >= this.left &&
            x <= this.right &&
            y >= this.top &&
            y <= this.bottom
        )
    }

    contains(p: PointVector) {
        return this.containsPoint(p.x, p.y)
    }

    encloses(bounds: Bounds) {
        return (
            this.containsPoint(bounds.left, bounds.top) &&
            this.containsPoint(bounds.left, bounds.bottom) &&
            this.containsPoint(bounds.right, bounds.top) &&
            this.containsPoint(bounds.right, bounds.bottom)
        )
    }

    toCSS(): { left: string; top: string; width: string; height: string } {
        return {
            left: `${this.left}px`,
            top: `${this.top}px`,
            width: `${this.width}px`,
            height: `${this.height}px`,
        }
    }

    toProps(): { x: number; y: number; width: number; height: number } {
        return { x: this.x, y: this.y, width: this.width, height: this.height }
    }

    toArray(): [[number, number], [number, number]] {
        return [
            [this.left, this.top],
            [this.right, this.bottom],
        ]
    }

    xRange(): [number, number] {
        return [this.left, this.right]
    }

    split(pieces: number, padding: SplitBoundsPadding = {}) {
        // Splits a rectangle into smaller rectangles.
        // The Facet Storybook has a visual demo of how this works.
        // I form the smallest possible square and then fill that up. This always goes left to right, top down.
        // So when we don't have a round number we first add a column, then a row, etc, until we reach the next square.
        // In the future we may want to position these bounds in custom ways, but this only does basic splitting for now.
        // NB: The off-by-one-pixel scenarios have NOT yet been unit tested. Karma points for the person who adds those tests and makes
        // any required adjustments.
        const { columnPadding = 0, rowPadding = 0, outerPadding = 0 } = padding
        const { columns, rows } = makeGrid(pieces)
        const contentWidth =
            this.width - columnPadding * (columns - 1) - outerPadding * 2
        const contentHeight =
            this.height - rowPadding * (rows - 1) - outerPadding * 2
        const boxWidth = Math.floor(contentWidth / columns)
        const boxHeight = Math.floor(contentHeight / rows)
        return range(0, pieces).map(
            (index: number) =>
                new Bounds(
                    outerPadding +
                        (index % columns) * (boxWidth + columnPadding),
                    outerPadding +
                        Math.floor(index / columns) * (boxHeight + rowPadding),
                    boxWidth,
                    boxHeight
                )
        )
    }

    yRange(): [number, number] {
        return [this.bottom, this.top]
    }

    equals(bounds: Bounds) {
        return (
            this.x === bounds.x &&
            this.y === bounds.y &&
            this.width === bounds.width &&
            this.height === bounds.height
        )
    }

    // Calculate squared distance between a given point and the closest border of the bounds
    // If the point is within the bounds, returns 0
    private distanceToPointSq(p: PointVector) {
        if (this.contains(p)) return 0

        const cx = Math.max(Math.min(p.x, this.x + this.width), this.x)
        const cy = Math.max(Math.min(p.y, this.y + this.height), this.y)
        return (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy)
    }

    distanceToPoint(p: PointVector) {
        return Math.sqrt(this.distanceToPointSq(p))
    }
}

interface SplitBoundsPadding {
    columnPadding?: number
    rowPadding?: number
    outerPadding?: number
}

// Since nearly all our components need a bounds, but most tests don't care about bounds, have a default bounds
// to use so we don't have to create a bounds for every test.
export const DEFAULT_BOUNDS = new Bounds(0, 0, 640, 480)
