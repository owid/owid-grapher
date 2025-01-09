import { useEffect, useMemo, useRef, useState } from "react"
import { Form, Input, InputRef, Modal, Spin } from "antd"

export const NarrativeChartNameModal = (props: {
    initialName: string
    open: "open" | "open-loading" | "closed"
    errorMsg?: string
    onSubmit: (name: string) => void
    onCancel?: () => void
}) => {
    const [name, setName] = useState<string>(props.initialName)
    const inputField = useRef<InputRef>(null)
    const isLoading = useMemo(() => props.open === "open-loading", [props.open])
    const isOpen = useMemo(() => props.open !== "closed", [props.open])

    useEffect(() => setName(props.initialName), [props.initialName])

    useEffect(() => {
        if (isOpen) {
            inputField.current?.focus({ cursor: "all" })
        }
    }, [isOpen])

    return (
        <Modal
            title="Save as narrative chart"
            open={isOpen}
            onOk={() => props.onSubmit(name)}
            onCancel={props.onCancel}
            onClose={props.onCancel}
            okButtonProps={{ disabled: !name || isLoading }}
            cancelButtonProps={{ disabled: isLoading }}
        >
            <div>
                <p>
                    This will create a new narrative chart that is linked to
                    this chart. Any currently pending changes will be applied to
                    the narrative chart.
                </p>
                <p>
                    Please enter a programmatic name for the narrative chart.{" "}
                    <i>Note that this name cannot be changed later.</i>
                </p>
                <Form.Item label="Name">
                    <Input
                        ref={inputField}
                        onChange={(e) => setName(e.target.value)}
                        value={name}
                        disabled={isLoading}
                    />
                </Form.Item>
                {isLoading && <Spin />}
                {props.errorMsg && (
                    <div
                        className="alert alert-danger"
                        style={{ whiteSpace: "pre-wrap" }}
                    >
                        {props.errorMsg}
                    </div>
                )}
            </div>
        </Modal>
    )
}
