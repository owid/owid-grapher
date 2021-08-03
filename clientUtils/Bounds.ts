import { isNumber, mapValues, range } from "./Util"
import { PointVector } from "./PointVector"
import pixelWidth from "string-pixel-width"
import { Box, GridParameters, Position, PositionMap } from "./owidTypes"

// Important utility class for all visualizations
// Since we want to be able to render charts headlessly and functionally, we
// can't rely on the DOM to do these calculations for us, and instead must
// calculate using geometry and first principles

type PadObject = PositionMap<number>

export interface GridBounds {
    col: number
    row: number
    edges: Set<Position>
    bounds: Bounds
}

export class Bounds {
    static ctx: CanvasRenderingContext2D

    static fromProps(props: Box): Bounds {
        const { x, y, width, height } = props
        return new Bounds(x, y, width, height)
    }

    static fromBBox(bbox: Box): Bounds {
        return this.fromProps(bbox)
    }

    static fromRect(rect: ClientRect): Bounds {
        return new Bounds(rect.left, rect.top, rect.width, rect.height)
    }

    static fromElement(el: HTMLElement): Bounds {
        return Bounds.fromRect(el.getBoundingClientRect())
    }

    static fromCorners(p1: PointVector, p2: PointVector): Bounds {
        const x1 = Math.min(p1.x, p2.x)
        const x2 = Math.max(p1.x, p2.x)
        const y1 = Math.min(p1.y, p2.y)
        const y2 = Math.max(p1.y, p2.y)

        return new Bounds(x1, y1, x2 - x1, y2 - y1)
    }

    // Merge a collection of bounding boxes into a single encompassing Bounds
    static merge(boundsList: Bounds[]): Bounds {
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

    static empty(): Bounds {
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
    ): Bounds {
        // Collapse contiguous spaces into one
        str = str.replace(/ +/g, " ")

        const isBold = fontWeight >= 600

        let bounds = Bounds.empty()
        if (str) {
            // pixelWidth uses a precomputed character width table to quickly give a
            // rough estimate of string width based on characters in a string - it is probably not
            // worth caching further
            const width = pixelWidth(str, {
                font: "arial",
                size: fontSize,
                bold: isBold,
            })
            const height = fontSize
            bounds = new Bounds(x, y - height, width, height)
        }

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

    get left(): number {
        return this.x
    }
    get top(): number {
        return this.y
    }
    get right(): number {
        return this.x + this.width
    }
    get bottom(): number {
        return this.y + this.height
    }
    get centerX(): number {
        return this.x + this.width / 2
    }
    get centerY(): number {
        return this.y + this.height / 2
    }
    get centerPos(): PointVector {
        return new PointVector(this.centerX, this.centerY)
    }
    get area(): number {
        return this.width * this.height
    }

    get topLeft(): PointVector {
        return new PointVector(this.left, this.top)
    }
    get topRight(): PointVector {
        return new PointVector(this.right, this.top)
    }
    get bottomLeft(): PointVector {
        return new PointVector(this.left, this.bottom)
    }
    get bottomRight(): PointVector {
        return new PointVector(this.right, this.bottom)
    }

    padLeft(amount: number): Bounds {
        return new Bounds(
            this.x + amount,
            this.y,
            this.width - amount,
            this.height
        )
    }

    padRight(amount: number): Bounds {
        return new Bounds(this.x, this.y, this.width - amount, this.height)
    }

    padBottom(amount: number): Bounds {
        return new Bounds(this.x, this.y, this.width, this.height - amount)
    }

    padTop(amount: number): Bounds {
        return new Bounds(
            this.x,
            this.y + amount,
            this.width,
            this.height - amount
        )
    }

    padWidth(amount: number): Bounds {
        return new Bounds(
            this.x + amount,
            this.y,
            this.width - amount * 2,
            this.height
        )
    }

    padHeight(amount: number): Bounds {
        return new Bounds(
            this.x,
            this.y + amount,
            this.width,
            this.height - amount * 2
        )
    }

    fromLeft(amount: number): Bounds {
        return this.padRight(this.width - amount)
    }

    fromBottom(amount: number): Bounds {
        return this.padTop(this.height - amount)
    }

    pad(amount: number | PadObject): Bounds {
        if (isNumber(amount)) {
            return new Bounds(
                this.x + amount,
                this.y + amount,
                this.width - amount * 2,
                this.height - amount * 2
            )
        }
        return this.padTop(amount.top ?? 0)
            .padRight(amount.right ?? 0)
            .padBottom(amount.bottom ?? 0)
            .padLeft(amount.left ?? 0)
    }

    expand(amount: number | PadObject): Bounds {
        if (isNumber(amount)) return this.pad(-amount)
        return this.pad(
            mapValues(amount, (v) => (v !== undefined ? -v : undefined))
        )
    }

    set(props: {
        x?: number
        y?: number
        width?: number
        height?: number
    }): Bounds {
        return Bounds.fromProps({ ...this, ...props })
    }

    scale(scale: number): Bounds {
        return new Bounds(
            this.x * scale,
            this.y * scale,
            this.width * scale,
            this.height * scale
        )
    }

    intersects(otherBounds: Bounds): boolean {
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

    boundedPoint(p: PointVector): PointVector {
        return new PointVector(
            Math.max(Math.min(p.x, this.right), this.left),
            Math.max(Math.min(p.y, this.bottom), this.top)
        )
    }

    containsPoint(x: number, y: number): boolean {
        return (
            x >= this.left &&
            x <= this.right &&
            y >= this.top &&
            y <= this.bottom
        )
    }

    contains(p: PointVector): boolean {
        return this.containsPoint(p.x, p.y)
    }

    encloses(bounds: Bounds): boolean {
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

    grid(
        gridParams: GridParameters,
        padding: SplitBoundsPadding = {}
    ): GridBounds[] {
        const { columns, rows } = gridParams
        const { columnPadding = 0, rowPadding = 0, outerPadding = 0 } = padding

        const contentWidth =
            this.width - columnPadding * (columns - 1) - outerPadding * 2
        const contentHeight =
            this.height - rowPadding * (rows - 1) - outerPadding * 2
        const boxWidth = Math.floor(contentWidth / columns)
        const boxHeight = Math.floor(contentHeight / rows)

        return range(0, rows * columns).map((index: number) => {
            const col = index % columns
            const row = Math.floor(index / columns)
            const edges = new Set<Position>()
            if (col === 0) edges.add(Position.left)
            if (col === columns - 1) edges.add(Position.right)
            if (row === 0) edges.add(Position.top)
            if (row === rows - 1) edges.add(Position.bottom)
            return {
                row,
                col,
                edges,
                bounds: new Bounds(
                    this.x + outerPadding + col * (boxWidth + columnPadding),
                    this.y + outerPadding + row * (boxHeight + rowPadding),
                    boxWidth,
                    boxHeight
                ),
            }
        })
    }

    yRange(): [number, number] {
        return [this.bottom, this.top]
    }

    equals(bounds: Bounds): boolean {
        return (
            this.x === bounds.x &&
            this.y === bounds.y &&
            this.width === bounds.width &&
            this.height === bounds.height
        )
    }

    // Calculate squared distance between a given point and the closest border of the bounds
    // If the point is within the bounds, returns 0
    private distanceToPointSq(p: PointVector): number {
        if (this.contains(p)) return 0

        const cx = Math.max(Math.min(p.x, this.x + this.width), this.x)
        const cy = Math.max(Math.min(p.y, this.y + this.height), this.y)
        return (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy)
    }

    distanceToPoint(p: PointVector): number {
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
