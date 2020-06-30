import { GlobalEntitySelection } from "../global-entity/GlobalEntitySelection"

export abstract class Figure {
    abstract get isLoaded(): boolean
    abstract get hasPreview(): boolean
    abstract get container(): HTMLElement
    abstract get boundingRect(): DOMRect
    abstract load(props: LoadProps): void
}

export interface LoadProps {
    globalEntitySelection?: GlobalEntitySelection
}
