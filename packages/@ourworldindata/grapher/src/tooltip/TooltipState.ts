import { observable, computed, action, makeObservable } from "mobx"
import { PointVector } from "@ourworldindata/utils"
import { TooltipFadeMode } from "./TooltipProps"

const TOOLTIP_FADE_DURATION = 400 // $fade-time + $fade-delay in scss

interface TooltipStateArgs {
    fade?: TooltipFadeMode
}

export class PlainTooltipState<T> {
    position = new PointVector(0, 0)

    protected _target: T | undefined = undefined
    protected _timer: number | undefined = undefined
    protected _fade: TooltipFadeMode

    constructor({ fade }: TooltipStateArgs = {}) {
        this._fade = fade ?? "delayed"
    }

    get target(): T | undefined {
        return this._target
    }

    set target(newTarget: T | null) {
        this.setTarget(newTarget)
    }

    get fading(): TooltipFadeMode | undefined {
        // returns "delayed"|"immediate" during the timeout after clearing the target
        return !!this._timer && !!this._target ? this._fade : undefined
    }

    protected setTarget(newTarget: T | null): void {
        // delay clearing the target (and hiding the tooltip) for a bit to prevent
        // flicker when frobbing between neighboring elements and allow an opacity
        // transition to smoothly fade the tooltip out
        clearTimeout(this._timer)

        if (newTarget === null) {
            const speed = { delayed: 1, immediate: 0.5, none: 0 }[this._fade]
            this._timer = window.setTimeout(
                () => this.resetTarget(),
                speed * TOOLTIP_FADE_DURATION
            )
        } else {
            this._target = newTarget
            this._timer = undefined
        }
    }

    protected resetTarget(): void {
        this._target = undefined
        this._timer = undefined
    }
}

export class TooltipState<T> extends PlainTooltipState<T> {
    constructor(args?: TooltipStateArgs) {
        super(args)

        makeObservable<
            this,
            "_target" | "_timer" | "setTarget" | "resetTarget"
        >(this, {
            // observables
            position: observable,
            _target: observable,
            _timer: observable,

            // computed (getters)
            target: computed,
            fading: computed,

            // actions
            setTarget: action.bound,
            resetTarget: action.bound,
        })
    }
}
