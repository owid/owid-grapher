export interface MapDataValue {
    entity: string
    value: number | string
    displayValue: string
    time: number
    isSelected?: boolean
}

export interface ChoroplethDatum extends MapDataValue {
    color: string
    highlightFillColor: string
}

export interface ChoroplethData {
    [key: string]: ChoroplethDatum
}
