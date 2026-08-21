import * as React from "react"
import cx from "clsx"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { isTargetOutsideElement } from "../chart/ChartUtils"
import { isOwidDropdownOpen } from "../controls/Dropdown"

export const DrawerContext = React.createContext<{
    toggleDrawerVisibility?: () => void
}>({})

interface SlideInDrawerProps {
    active: boolean
    toggle: () => void
    children: React.ReactNode
    grapherRef?: React.RefObject<HTMLDivElement | null>
}

@observer
export class SlideInDrawer extends React.Component<SlideInDrawerProps> {
    visible: boolean = this.props.active // true while the drawer is active and during enter/exit transitions
    // False exactly when the drawer's DOM is absent. render() returns null while
    // closed, so the drawer is created fresh on every open; the panel has to be
    // painted in its closed position before we flip to open, or the transition
    // has no start value to animate from.
    mounted: boolean = false
    drawerRef = React.createRef<HTMLDivElement>()
    private mountFrame?: number

    constructor(props: SlideInDrawerProps) {
        super(props)

        makeObservable(this, {
            visible: observable.ref,
            mounted: observable.ref,
        })
    }

    override componentDidMount(): void {
        document.addEventListener("keydown", this.onDocumentKeyDown)
        document.addEventListener("pointerdown", this.onDocumentPointerDown, {
            capture: true,
        })
        document.addEventListener("click", this.onDocumentClick, {
            capture: true,
        })
        if (this.active) this.scheduleMountFlip()
    }

    override componentWillUnmount(): void {
        document.removeEventListener("keydown", this.onDocumentKeyDown)
        document.removeEventListener(
            "pointerdown",
            this.onDocumentPointerDown,
            {
                capture: true,
            }
        )
        document.removeEventListener("click", this.onDocumentClick, {
            capture: true,
        })
        if (this.mountFrame !== undefined) cancelAnimationFrame(this.mountFrame)
    }

    override componentDidUpdate(): void {
        const grapherElement = this.props.grapherRef?.current
        if (grapherElement) {
            grapherElement.style.overflowX =
                this.active || this.visible ? "clip" : "visible"
        }

        // Flip per open, not once per component lifetime: this component is
        // rendered unconditionally by Grapher, so componentDidMount fires at
        // chart load rather than when the drawer opens. When the drawer is
        // reopened mid-close the DOM is still painted and `mounted` is still
        // true, so no flip happens and the transition simply retargets.
        if (this.active && !this.mounted) this.scheduleMountFlip()
    }

    // Two frames: the first still runs before the closed state is painted, the
    // second runs after it, so flipping to open there produces a transition.
    private scheduleMountFlip(): void {
        if (this.mountFrame !== undefined) return
        this.mountFrame = requestAnimationFrame(() => {
            this.mountFrame = requestAnimationFrame(() => {
                this.mountFrame = undefined
                this.setMounted(true)
            })
        })
    }

    @action.bound private setMounted(mounted: boolean): void {
        this.mounted = mounted
    }

    @action.bound onDocumentKeyDown(e: KeyboardEvent): void {
        // dismiss menu on esc
        if (this.active && e.key === "Escape") this.toggleVisibility()
    }

    // Handles mouse/touch/pen – fires before react-aria mounts its
    // popover underlay, avoiding the race condition with portaled popovers.
    @action.bound onDocumentPointerDown(e: PointerEvent): void {
        this.dismissIfOutside(e)
    }

    // Handles keyboard-initiated activations (Enter/Space) which fire
    // a synthetic click with detail === 0 and no preceding pointerdown.
    @action.bound onDocumentClick(e: MouseEvent): void {
        if (e.detail > 0) return // mouse click – already handled by pointerdown
        this.dismissIfOutside(e)
    }

    private dismissIfOutside(e: Event): void {
        if (
            this.active &&
            this.drawerRef?.current &&
            isTargetOutsideElement(e.target!, this.drawerRef.current) &&
            !isOwidDropdownOpen()
        )
            this.toggleVisibility()
    }

    @action.bound toggleVisibility(e?: React.MouseEvent): void {
        this.props.toggle()
        if (this.active) this.visible = true
        e?.stopPropagation()
    }

    @action.bound onBackdropTransitionEnd(e: React.TransitionEvent): void {
        // Transitions from children bubble; only the backdrop's own fade marks
        // the end of the exit.
        if (e.target !== e.currentTarget) return
        if (e.propertyName !== "opacity") return
        if (!this.active) {
            this.visible = false
            // The DOM goes away with `visible`, so the next open needs a fresh
            // closed-state paint before it can transition.
            this.mounted = false
        }
    }

    @computed private get active(): boolean {
        return this.props.active
    }

    override render(): React.ReactElement | null {
        const { visible, active } = this

        if (active || visible) {
            return (
                <div
                    className={cx("drawer", { active: this.active })}
                    data-state={this.active && this.mounted ? "open" : "closed"}
                    ref={this.drawerRef}
                >
                    <div
                        className="drawer-backdrop"
                        onClick={this.toggleVisibility}
                        onTransitionEnd={this.onBackdropTransitionEnd} // triggers unmount
                    ></div>
                    <div className="drawer-contents">
                        <DrawerContext.Provider
                            value={{
                                toggleDrawerVisibility: this.toggleVisibility,
                            }}
                        >
                            {this.props.children}
                        </DrawerContext.Provider>
                    </div>
                </div>
            )
        }

        return null
    }
}
