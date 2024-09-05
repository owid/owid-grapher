import React from "react"
import { NavLink } from "react-router-dom"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    to: string
    replace?: boolean
    native?: boolean
}

export class Link extends React.Component<LinkProps> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        const { native, to, ...rest } = this.props
        if (native) return <a href={this.context.admin.url(to)} {...rest} />
        else return <NavLink to={to} {...rest} />
    }
}
