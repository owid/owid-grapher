import * as React from "react"
import { NavLink, useHistory } from "react-router-dom"
import { Button, ButtonProps } from "antd"
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

/**
 * An antd `Button` that navigates within the admin SPA — the replacement for
 * the `<Link className="btn btn-*">` markup the admin used under Bootstrap.
 *
 * antd's `Button` renders a real `<a href>` when given `href`, so this keeps
 * cmd/ctrl-click, middle-click and "copy link address" working; a plain
 * left-click is intercepted and handed to React Router so that it stays a
 * client-side navigation rather than a full page load.
 */
export function LinkButton({
    to,
    replace,
    onClick,
    ...buttonProps
}: { to: string; replace?: boolean } & Omit<
    ButtonProps,
    "href"
>): React.ReactElement {
    const history = useHistory()
    return (
        <Button
            href={history.createHref({ pathname: to })}
            onClick={(event) => {
                onClick?.(event)
                const isModified =
                    event.defaultPrevented ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    (event as React.MouseEvent).button !== 0
                if (isModified) return
                event.preventDefault()
                if (replace) history.replace(to)
                else history.push(to)
            }}
            {...buttonProps}
        />
    )
}
