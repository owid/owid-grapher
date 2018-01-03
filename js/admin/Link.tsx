import * as React from 'react'

export default function Link(props: { href: string, children: any }) {
    return <a href={props.href}>{props.children}</a>
}
