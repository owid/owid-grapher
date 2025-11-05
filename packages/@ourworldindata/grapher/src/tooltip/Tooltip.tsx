import * as React from "react"
import { observable, computed, action, makeObservable, runInAction } from "mobx"
import { observer } from "mobx-react"
import { PointVector } from "@ourworldindata/utils"
import {
    TooltipProps,
    TooltipManager,
    TooltipFadeMode,
    TooltipContainerProps,
} from "./TooltipProps"
import {
    TooltipCardContainer,
    calculateTooltipTargetWithFade,
    getTooltipFadeMode,
    DEFAULT_TOOLTIP_FADE_MODE,
} from "./TooltipCore"

export * from "./TooltipContents.js"

export class TooltipState<T> {
    position = new PointVector(0, 0)
    _target: T | undefined = undefined
    _timer: number | undefined = undefined
    _fade: TooltipFadeMode

    constructor({ fade }: { fade?: TooltipFadeMode } = {}) {
        makeObservable(this, {
            position: observable,
            _target: observable,
            _timer: observable,
        })
        this._fade = fade ?? DEFAULT_TOOLTIP_FADE_MODE
    }

    @computed
    get target(): T | undefined {
        return this._target
    }

    @action.bound resetTarget(): void {
        this._target = undefined
        this._timer = undefined
    }

    set target(newTarget: T | null) {
        const result = calculateTooltipTargetWithFade({
            newTarget,
            fade: this._fade,
            timer: this._timer,
            resetTarget: () => this.resetTarget(),
        })
        runInAction(() => {
            this._target = result.target
            this._timer = result.timer
        })
    }

    @computed
    get fading(): TooltipFadeMode | undefined {
        return getTooltipFadeMode({
            timer: this._timer,
            target: this._target,
            fade: this._fade,
        })
    }
}

interface ManagedTooltipContainerProps extends TooltipContainerProps {
    tooltipManager: TooltipManager
}

@observer
export class TooltipContainer extends React.Component<ManagedTooltipContainerProps> {
    constructor(props: ManagedTooltipContainerProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get tooltip(): TooltipProps | undefined {
        const { tooltip } = this.props.tooltipManager
        return tooltip?.get()
    }

    @computed private get tooltipProvider(): {
        tooltip: TooltipProps | undefined
    } {
        return { tooltip: this.tooltip }
    }

    override render(): React.ReactElement | null {
        return (
            <TooltipCardContainer
                {...this.props}
                tooltipProvider={this.tooltipProvider}
            />
        )
    }
}

interface ManagedTooltipProps extends TooltipProps {
    tooltipManager: TooltipManager
}

@observer
export class Tooltip extends React.Component<ManagedTooltipProps> {
    constructor(props: ManagedTooltipProps) {
        super(props)
        makeObservable(this)
    }

    override componentDidMount(): void {
        this.connectTooltipToContainer()
    }

    @action.bound private connectTooltipToContainer(): void {
        this.props.tooltipManager.tooltip?.set(this.props)
    }

    @action.bound private removeToolTipFromContainer(): void {
        this.props.tooltipManager.tooltip?.set(undefined)
    }

    override componentDidUpdate(): void {
        this.connectTooltipToContainer()
    }

    override componentWillUnmount(): void {
        this.removeToolTipFromContainer()
    }

    override render(): null {
        return null
    }
}
