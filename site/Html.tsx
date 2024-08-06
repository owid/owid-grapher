import cx from "classnames"
import React, { HtmlHTMLAttributes } from "react"

/**
 * Renders a <html> element with the class "js-disabled" to indicate that JavaScript is disabled.
 * This is then removed *synchronously* by the client-side JavaScript, once we detect that JavaScript is enabled.
 * See the <script> tag in Head.tsx for the client-side JavaScript that removes this class.
 */
export const Html = (props: HtmlHTMLAttributes<Element>) => {
    return <html {...props} className={cx("js-disabled", props.className)} />
}
