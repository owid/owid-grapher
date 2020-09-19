export interface ChoroplethMark {
    entity: string
    value: number | string
    displayValue: string
    time: number
    isSelected?: boolean
    color: string
    highlightFillColor: string
}

export interface ChoroplethMarks {
    [key: string]: ChoroplethMark
}
