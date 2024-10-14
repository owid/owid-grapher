import classNames from "classnames"
import React from "react"

export interface TabBarProps {
    className?: string
    children: React.ReactNode
}

export const TabBar = (props: TabBarProps): React.ReactElement => {
    return (
        <ul className={classNames("tab-bar", props.className)}>
            {props.children}
        </ul>
    )
}

export interface TabProps {
    tabId: string
    isActive?: boolean
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    analyticsLabel?: string
    children: React.ReactNode
}

export const Tab = (props: TabProps): React.ReactElement => {
    const className = "tab clickable" + (props.isActive ? " active" : "")
    return (
        <li key={props.tabId} className={className}>
            <button
                onClick={props.onClick}
                data-track-note={props.analyticsLabel}
                aria-label={props.tabId}
                type="button"
            >
                {props.children}
            </button>
        </li>
    )
}
