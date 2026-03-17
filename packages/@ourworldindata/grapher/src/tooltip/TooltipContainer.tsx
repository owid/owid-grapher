import * as React from "react"
import { computed, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    TooltipProps,
    TooltipManager,
    TooltipContainerProps,
} from "./TooltipProps"
import { TooltipCard } from "./Tooltip.js"

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

    override render(): React.ReactElement | null {
        const { props, tooltip } = this
        if (!tooltip) return null
        return <TooltipCard {...props} {...tooltip} />
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
