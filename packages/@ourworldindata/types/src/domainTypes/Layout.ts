export enum Position {
    top = "top",
    right = "right",
    bottom = "bottom",
    left = "left",
}

export type PositionMap<Value> = {
    [key in Position]?: Value
}

export enum HorizontalAlign {
    left = "left",
    center = "center",
    right = "right",
}

export enum VerticalAlign {
    top = "top",
    middle = "middle",
    bottom = "bottom",
}

export enum AxisAlign {
    start = "start",
    middle = "middle",
    end = "end",
}

export interface GridParameters {
    rows: number
    columns: number
    count: number
}
