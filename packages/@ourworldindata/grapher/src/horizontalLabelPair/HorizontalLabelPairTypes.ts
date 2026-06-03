import { Bounds, HorizontalAlign } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"

export interface HorizontalLabel {
    text: string
    x: number
    color?: string
    textAnchor?: HorizontalAlign
}

export interface SizedHorizontalLabel extends HorizontalLabel {
    textWrap: TextWrap
}

export interface PlacedHorizontalLabel extends SizedHorizontalLabel {
    bounds: Bounds
}
