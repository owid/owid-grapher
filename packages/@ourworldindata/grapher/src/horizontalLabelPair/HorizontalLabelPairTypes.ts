import { Bounds, HorizontalAlign } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"

export interface InitialHorizontalLabel {
    text: string
    x: number
    color?: string
    textAnchor?: HorizontalAlign
}

export interface SizedHorizontalLabel extends InitialHorizontalLabel {
    textWrap: TextWrap
}

export interface PlacedHorizontalLabel extends SizedHorizontalLabel {
    bounds: Bounds
}
