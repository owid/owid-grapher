import { useEffect, useRef, useState } from "react"
import { Form, Input, InputRef, Modal } from "antd"
import {
    KEBAB_CASE_ERROR_MSG,
    KEBAB_CASE_REGEX,
} from "../adminShared/validation.js"

export const NarrativeChartNameModal = (props: {
    initialName: string
    isOpen: boolean
    errorMsg?: string
    onSubmit: (name: string) => Promise<void>
    onCancel?: () => void
}) => {
    const [form] = Form.useForm()
    const [confirmLoading, setConfirmLoading] = useState(false)
    const inputRef = useRef<InputRef>(null)

    useEffect(() => {
        if (props.isOpen) {
            // Necessary for the focus to work, presumably because of the
            // modal's animation.
            const timeout = setTimeout(
                () => inputRef.current?.focus({ cursor: "all" }),
                100
            )
            return () => clearTimeout(timeout)
        }
        return undefined
    }, [props.isOpen])

    async function handleFinish() {
        setConfirmLoading(true)
        await props.onSubmit(form.getFieldValue("name"))
        setConfirmLoading(false)
    }

    return (
        <Modal
            title="Save as narrative chart"
            open={props.isOpen}
            onCancel={props.onCancel}
            onClose={props.onCancel}
            okText="Create"
            okButtonProps={{ htmlType: "submit" }}
            confirmLoading={confirmLoading}
            destroyOnClose
            modalRender={(modal) => (
                <Form
                    form={form}
                    initialValues={{ name: props.initialName }}
                    onFinish={handleFinish}
                    clearOnDestroy
                >
                    {modal}
                </Form>
            )}
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
                <Form.Item
                    name="name"
                    label="Name"
                    rules={[
                        { required: true, message: "Please enter a name" },
                        {
                            pattern: KEBAB_CASE_REGEX,
                            message: KEBAB_CASE_ERROR_MSG,
                        },
                    ]}
                >
                    <Input ref={inputRef} />
                </Form.Item>
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
