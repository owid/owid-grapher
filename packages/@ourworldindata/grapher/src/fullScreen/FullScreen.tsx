import * as React from "react"
import cx from "clsx"
import { action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { BodyPortal } from "@ourworldindata/components"
import { isTargetOutsideElement } from "../chart/ChartUtils"

interface FullScreenProps {
    children: React.ReactNode
    onDismiss: () => void
    isDimmed?: boolean
}

@observer
export class FullScreen extends React.Component<FullScreenProps> {
    content = React.createRef<HTMLDivElement>()

    constructor(props: FullScreenProps) {
        super(props)
        makeObservable(this)
    }

    @action.bound onDocumentClick(e: React.MouseEvent): void {
        if (
            this.content?.current &&
            isTargetOutsideElement(e.target, this.content.current)
        )
            this.props.onDismiss()
    }

    @action.bound onDocumentKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") this.props.onDismiss()
    }

    override componentDidMount(): void {
        document.addEventListener("keydown", this.onDocumentKeyDown)
    }

    override componentWillUnmount(): void {
        document.removeEventListener("keydown", this.onDocumentKeyDown)
    }

    override render() {
        return (
            <BodyPortal>
                <div
                    className={cx("FullScreenOverlay", {
                        "FullScreenOverlay--dimmed": this.props.isDimmed,
                    })}
                    role="dialog"
                    aria-modal="true"
                    onClick={this.onDocumentClick}
                >
                    <div className="FullScreenContent" ref={this.content}>
                        {this.props.children}
                    </div>
                </div>
            </BodyPortal>
        )
    }
}
