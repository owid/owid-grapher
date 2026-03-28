declare module "fast-kde" {
    export interface Density1dOptions<T = any> {
        adjust?: number
        pad?: number
        bins?: number
        x?: (d: T) => number
        weight?: (d: T) => number
        bandwidth?: number
        extent?: [number, number]
    }

    export interface Density1dEstimator {
        [Symbol.iterator](): Generator<{ x: number; y: number }>
        points(x?: string, y?: string): Generator<{ [key: string]: number }>
        grid(): Float64Array
        extent(): [number, number]
        bandwidth(value?: number): number | Density1dEstimator
    }

    export function density1d<T = any>(
        data: T[],
        options?: Density1dOptions<T>
    ): Density1dEstimator

    export interface Density2dOptions<T = any> {
        adjust?: number
        pad?: number
        bins?: [number, number] | number
        x?: (d: T) => number
        y?: (d: T) => number
        weight?: (d: T) => number
        bandwidth?: [number, number] | number
        extent?: [[number, number], [number, number]] | [number, number]
    }

    export interface Density2dEstimator {
        [Symbol.iterator](): Generator<{ x: number; y: number; z: number }>
        points(
            x?: string,
            y?: string,
            z?: string
        ): Generator<{ [key: string]: number }>
        grid(): Float64Array
        extent(): [[number, number], [number, number]]
        heatmap(options?: {
            color?: (t: number) => string | { r: number; g: number; b: number }
            clamp?: [number, number]
            canvas?: HTMLCanvasElement
            maxColors?: number
        }): HTMLCanvasElement
        bandwidth(
            value?: [number, number] | number
        ): [number, number] | Density2dEstimator
    }

    export function density2d<T = any>(
        data: T[],
        options?: Density2dOptions<T>
    ): Density2dEstimator

    export function nrd<T = any>(data: T[], accessor?: (d: T) => number): number

    export function opacityMap(
        r: number,
        g: number,
        b: number
    ): (opacity: number) => { r: number; g: number; b: number; opacity: number }
}
