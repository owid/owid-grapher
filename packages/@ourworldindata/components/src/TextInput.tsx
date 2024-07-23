import * as React from "react"
import { forwardRef } from "react"
import cx from "classnames"

export type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    className?: string
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
    function TextInput({ className, ...props }: TextInputProps, ref) {
        return (
            <input
                className={cx("text-input", className)}
                ref={ref}
                {...props}
            />
        )
    }
)
