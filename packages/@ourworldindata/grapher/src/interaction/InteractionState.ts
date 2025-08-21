export class InteractionState {
    /**
     * Whether the series is currently interacted with
     */
    private _isInteractedWith = false

    /**
     * Whether _any_ series in a chart is currently interacted with
     */
    private _isInteractionModeActive = false

    /**
     * If `isInteractedWith` is true, then the given series is currently active,
     * (typically hovered or focused). If `isInteractionModeActive` is true, then
     * _any_ series in the chart is currently interacted with.
     *
     * If `isInteractedWith` is true, then `isInteractionModeActive` must also
     * be true. If the series isn't currently interacted with, `isInteractionModeActive`
     * can either be true (some other series is interacted with) or false
     * (no series is interacted with).
     */
    constructor(isInteractedWith = false, isInteractionModeActive?: boolean) {
        this._isInteractedWith = isInteractedWith
        this._isInteractionModeActive = isInteractedWith
            ? true // Must be active if the series is currently interacted with
            : (isInteractionModeActive ?? isInteractedWith)
    }

    /**
     * Whether the chart is in an idle state, i.e. no series are currently
     * being interacted with
     */
    get idle(): boolean {
        return !this._isInteractionModeActive
    }

    /**
     * Whether the series is currently interacted with
     */
    get active(): boolean {
        return this._isInteractedWith
    }

    /**
     * Whether the series is in the foreground, i.e. either the chart isn't
     * currently interacted with (i.e. all series are in the foreground by
     * default) or the series itself is currently interacted with
     */
    get foreground(): boolean {
        return !this._isInteractionModeActive || this._isInteractedWith
    }

    /**
     * Whether the series is in the background, i.e. the chart is currently
     * interacted with, but the given series isn't
     */
    get background(): boolean {
        return this._isInteractionModeActive && !this._isInteractedWith
    }
}
