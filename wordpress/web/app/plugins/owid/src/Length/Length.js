import { RadioControl } from "@wordpress/components"
const { useSelect, useDispatch } = wp.data

const LENGTH_META_FIELD = "owid_length_meta_field"
const DEFAULT = "short"

const Length = () => {
    const length = useSelect((select) => {
        return select("core/editor").getEditedPostAttribute("meta")[
            LENGTH_META_FIELD
        ]
    })

    const { editPost } = useDispatch("core/editor")

    return (
        <RadioControl
            help="The length of the post"
            selected={length || DEFAULT}
            options={[
                { label: "Short", value: DEFAULT },
                { label: "Standard", value: "standard" },
            ]}
            onChange={(value) =>
                editPost({
                    meta: { [LENGTH_META_FIELD]: value },
                })
            }
        />
    )
}

export default Length
