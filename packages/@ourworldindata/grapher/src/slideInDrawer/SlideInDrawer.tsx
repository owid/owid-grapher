import * as React from "react"
import cx from "classnames"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { isTargetOutsideElement } from "../chart/ChartUtils"

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
    drawerRef = React.createRef<HTMLDivElement>()

    constructor(props: SlideInDrawerProps) {
        super(props)

        makeObservable(this, {
            visible: observable.ref,
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
    }

    override componentDidUpdate(): void {
        const grapherElement = this.props.grapherRef?.current
        if (grapherElement) {
            grapherElement.style.overflowX =
                this.active || this.visible ? "clip" : "visible"
        }
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
            !this.isPortaledPopoverOpen()
        )
            this.toggleVisibility()
    }

    private isPortaledPopoverOpen(): boolean {
        // React-aria popovers (e.g. dropdown menus) are portaled to document.body
        // with a full-viewport underlay. While one is open, suppress drawer dismissal
        // so that the first click closes the popover (handled by react-aria) and a
        // subsequent click closes the drawer.
        // Note: "portaled-popover" class is defined in Dropdown.tsx. Update both if renaming.
        return document.querySelector(".portaled-popover") !== null
    }

    @action.bound toggleVisibility(e?: React.MouseEvent): void {
        this.props.toggle()
        if (this.active) this.visible = true
        e?.stopPropagation()
    }

    @action.bound onAnimationEnd(): void {
        if (!this.active) this.visible = false
    }

    @computed private get active(): boolean {
        return this.props.active
    }

    private animationFor(selector: string): React.CSSProperties {
        const phase = this.active ? "enter" : "exit"
        return {
            animationName: `${selector}-${phase}`,
            animationDuration: "333ms",
            animationFillMode: "forwards",
        }
    }

    override render(): React.ReactElement | null {
        const { visible, active } = this

        if (active || visible) {
            return (
                <div
                    className={cx("drawer", { active: this.active })}
                    ref={this.drawerRef}
                >
                    <div
                        className="drawer-backdrop"
                        onClick={this.toggleVisibility}
                        style={this.animationFor("drawer-backdrop")}
                        onAnimationEnd={this.onAnimationEnd} // triggers unmount
                    ></div>
                    <div
                        className="drawer-contents"
                        style={{
                            ...this.animationFor("drawer-contents"),
                        }}
                    >
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
