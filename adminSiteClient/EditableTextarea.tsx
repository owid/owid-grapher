import React, { useState, useCallback } from "react"
import { Button } from "antd"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faSave } from "@fortawesome/free-solid-svg-icons"
import TextArea from "antd/es/input/TextArea.js"

interface EditableTextareaProps {
    value: string
    onChange: (value: string) => void
    onSave: (value: string) => void
    className?: string
    autoResize?: boolean
    extraActions?: React.ReactNode
    placeholder?: string
    disabled?: boolean
    valid?: boolean
}

export function EditableTextarea({
    value,
    onChange,
    onSave,
    className,
    autoResize = false,
    extraActions,
    placeholder,
    disabled = false,
    valid = true,
}: EditableTextareaProps) {
    const [isDirty, setIsDirty] = useState(false)

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            onChange(e.target.value)
        },
        [onChange]
    )

    const handleSave = useCallback(() => {
        const trimmed = value.trim()
        onSave(trimmed)
        setIsDirty(false)
    }, [onSave, value])

    return (
        <div className={cx("EditableTextarea", className)}>
            <TextArea
                autoSize={autoResize}
                value={value}
                onChange={(e) => {
                    handleChange(e)
                    setIsDirty(true)
                }}
                placeholder={placeholder}
                disabled={disabled}
            />

            <div className="EditableTextarea__actions">
                {extraActions}

                <div className="EditableTextarea__save-action">
                    <Button
                        type="text"
                        onClick={handleSave}
                        disabled={!isDirty || disabled || !valid}
                    >
                        <FontAwesomeIcon icon={faSave} />
                    </Button>

                    {isDirty && (
                        <span className="EditableTextarea__unsaved-chip">
                            Unsaved
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
