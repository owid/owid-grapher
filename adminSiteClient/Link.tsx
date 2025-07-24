import * as React from "react"
import { NavLink } from "react-router-dom"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    to: string
    replace?: boolean
    native?: boolean
}

export class Link extends React.Component<LinkProps> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    override render() {
        const { native, to, ...rest } = this.props
        if (native) return <a href={this.context.admin.url(to)} {...rest} />
        else return <NavLink to={to} {...rest} />
    }
}
