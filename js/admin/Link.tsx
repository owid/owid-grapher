import * as React from 'react'
import { Link as ReactLink } from 'react-router-dom'
import { AdminAppContext } from './AdminAppContext'

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    to: string
    replace?: boolean,
    native?: boolean
}

export default class Link extends React.Component<LinkProps> {
    static contextType = AdminAppContext

    render() {
        const {native, to, ...rest} = this.props
        if (native)
            return <a href={this.context.admin.url(to)} {...rest}/>
        else
            return <ReactLink to={to} {...rest}/>
    }
}