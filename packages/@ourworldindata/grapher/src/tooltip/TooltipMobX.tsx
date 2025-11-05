import * as React from "react"
import { observable, computed, action, makeObservable, runInAction } from "mobx"
import { observer } from "mobx-react"
import { PointVector } from "@ourworldindata/utils"
import {
    TooltipProps,
    TooltipManager,
    TooltipFadeMode,
    TooltipContextProps,
    TooltipContainerCoreProps,
} from "./TooltipProps"
import { TooltipContainerCore, TOOLTIP_FADE_DURATION } from "./TooltipCore"

// MobX wrapper for TooltipState
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
        // "delayed" mode is good for charts with gaps between targetable areas
        // "immediate" is better if the tooltip is displayed for all points in the chart's bounds
        // "none" disables the fade transition altogether
        this._fade = fade ?? "delayed"
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
        // delay clearing the target (and hiding the tooltip) for a bit to prevent
        // flicker when frobbing between neighboring elements and allow an opacity
        // transition to smoothly fade the tooltip out
        clearTimeout(this._timer)
        runInAction(() => {
            if (newTarget === null) {
                const speed = { delayed: 1, immediate: 0.5, none: 0 }[
                    this._fade
                ]
                this._timer = window.setTimeout(
                    this.resetTarget,
                    speed * TOOLTIP_FADE_DURATION
                )
            } else {
                this._target = newTarget
                this._timer = undefined
            }
        })
    }

    @computed
    get fading(): TooltipFadeMode | undefined {
        // returns "delayed"|"immediate" during the timeout after clearing the target
        return !!this._timer && !!this._target ? this._fade : undefined
    }
}

interface TooltipContainerProps
    extends Omit<TooltipContainerCoreProps, "tooltipProvider"> {
    tooltipProvider: TooltipManager
}

@observer
export class TooltipContainer extends React.Component<TooltipContainerProps> {
    constructor(props: TooltipContainerProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get tooltip(): TooltipProps | undefined {
        const { tooltip } = this.props.tooltipProvider
        return tooltip?.get()
    }

    @computed private get tooltipProvider(): {
        tooltip: TooltipProps | undefined
    } {
        return { tooltip: this.tooltip }
    }

    override render(): React.ReactElement | null {
        return (
            <TooltipContainerCore
                {...this.props}
                tooltipProvider={this.tooltipProvider}
            />
        )
    }
}

@observer
export class Tooltip extends React.Component<TooltipProps> {
    constructor(props: TooltipProps) {
        super(props)
        makeObservable(this)
    }

    override componentDidMount(): void {
        this.connectTooltipToContainer()
    }

    @action.bound private connectTooltipToContainer(): void {
        this.props.tooltipManager?.tooltip?.set(this.props)
    }

    @action.bound private removeToolTipFromContainer(): void {
        this.props.tooltipManager?.tooltip?.set(undefined)
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
