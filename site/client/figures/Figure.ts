import { GlobalEntitySelection } from "site/globalEntityControl/GlobalEntitySelection"

export interface Figure {
    readonly isLoaded: boolean
    readonly hasPreview: boolean
    readonly container: HTMLElement
    readonly boundingRect: DOMRect
    readonly load: (props: LoadProps) => void
}

export interface LoadProps {
    globalEntitySelection?: GlobalEntitySelection
}
