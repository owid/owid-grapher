import React from "react"
import { createPortal } from "react-dom"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { GRAPHER_DRAWER_ID } from "../core/GrapherConstants"
import { CloseButton } from "../closeButton/CloseButton.js"

@observer
export class SlideInDrawer extends React.Component<{
    title: string
    active: boolean
    toggle: () => void
    children: React.ReactNode
}> {
    @observable.ref visible: boolean = this.props.active // true while the drawer is active and during enter/exit transitions
    contentRef: React.RefObject<HTMLDivElement> = React.createRef()

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

    @action.bound onDocumentKeyDown(e: KeyboardEvent): void {
        // dismiss menu on esc
        if (this.active && e.key === "Escape") this.toggleVisibility()
    }

    @action.bound onDocumentClick(e: MouseEvent): void {
        if (
            this.active &&
            this.contentRef?.current &&
            !this.contentRef.current.contains(e.target as Node) &&
            document.contains(e.target as Node)
        )
            this.toggleVisibility()
    }

    @action.bound toggleVisibility(e?: React.MouseEvent): void {
        this.props.toggle()
        if (this.active) this.visible = true
        this.drawer?.classList.toggle("active", this.active)
        e?.stopPropagation()
    }

    @action.bound onAnimationEnd(): void {
        if (!this.active) this.visible = false
    }

    @computed private get active(): boolean {
        return this.props.active
    }

    @computed private get drawer(): Element | null {
        return document.querySelector(`nav#${GRAPHER_DRAWER_ID}`)
    }

    private animationFor(selector: string): { animation: string } {
        const phase = this.active ? "enter" : "exit"
        return { animation: `${selector}-${phase} 333ms` }
    }

    @computed get drawerContents(): JSX.Element {
        return (
            <div ref={this.contentRef}>
                <div
                    className="grapher-drawer-backdrop"
                    onClick={this.toggleVisibility}
                    style={this.animationFor("grapher-drawer-backdrop")}
                    onAnimationEnd={this.onAnimationEnd} // triggers unmount
                ></div>
                <div
                    className="grapher-drawer-contents"
                    style={{
                        ...this.animationFor("grapher-drawer-contents"),
                    }}
                >
                    <div className="grapher-drawer-header">
                        <div className="grapher_h5-black-caps grapher_light">
                            {this.props.title}
                        </div>
                        <CloseButton onClick={() => this.toggleVisibility()} />
                    </div>

                    <div className="grapher-drawer-scrollable">
                        {this.props.children}
                    </div>
                </div>
            </div>
        )
    }

    render(): JSX.Element | null {
        const { visible, drawer, active } = this

        if (drawer && (active || visible)) {
            return createPortal(this.drawerContents, drawer)
        }

        return null
    }
}
