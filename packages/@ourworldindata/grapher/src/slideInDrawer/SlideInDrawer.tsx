import React from "react"
import cx from "classnames"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { isTargetOutsideElement } from "../chart/ChartUtils"

export const DrawerContext = React.createContext<{
    toggleDrawerVisibility?: () => void
}>({})

@observer
export class SlideInDrawer extends React.Component<{
    active: boolean
    toggle: () => void
    children: React.ReactNode
    grapherRef?: React.RefObject<HTMLDivElement>
}> {
    @observable.ref visible: boolean = this.props.active // true while the drawer is active and during enter/exit transitions
    drawerRef: React.RefObject<HTMLDivElement> = React.createRef()

    componentDidMount(): void {
        document.addEventListener("keydown", this.onDocumentKeyDown)
        document.addEventListener("click", this.onDocumentClick, {
            capture: true,
        })
    }

    componentWillUnmount(): void {
        document.removeEventListener("keydown", this.onDocumentKeyDown)
        document.removeEventListener("click", this.onDocumentClick, {
            capture: true,
        })
    }

    componentDidUpdate(): void {
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

    @action.bound onDocumentClick(e: MouseEvent): void {
        if (
            this.active &&
            this.drawerRef?.current &&
            isTargetOutsideElement(e.target!, this.drawerRef.current)
        )
            this.toggleVisibility()
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

    private animationFor(selector: string): { animation: string } {
        const phase = this.active ? "enter" : "exit"
        return { animation: `${selector}-${phase} 333ms` }
    }

    render(): React.ReactElement | null {
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
