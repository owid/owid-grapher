import * as React from 'react'
import { Link as ReactLink } from 'react-router-dom'

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    to: string
    replace?: boolean,
    native?: boolean
}

export default function Link(props: LinkProps, context: any) {
    const {native, to, ...rest} = props
    if (props.native)
        return <a href={context.admin.url(props.to)} {...rest}/>
    else
        return <ReactLink to={to} {...rest}/>
}
