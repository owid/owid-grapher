import { CheckboxControl } from "@wordpress/components"
const { useSelect, useDispatch } = wp.data

const PUBLICATION_CONTEXT_META_FIELD = "owid_publication_context_meta_field"

const PublicationContext = () => {
    const context = useSelect((select) => {
        return select("core/editor").getEditedPostAttribute("meta")[
            PUBLICATION_CONTEXT_META_FIELD
        ]
    })

    const { editPost } = useDispatch("core/editor")

    const onChangeHandler = (value) =>
        editPost({
            meta: {
                [PUBLICATION_CONTEXT_META_FIELD]: {
                    immediate_newsletter: !context.immediate_newsletter,
                    homepage: !context.homepage,
                    latest: !context.latest,
                },
            },
        })

    return (
        <>
            <CheckboxControl
                label="Immediate newsletter"
                help="Will be sent in the newsletter daily digest"
                checked={context.immediate_newsletter}
                onChange={onChangeHandler}
            />
            <CheckboxControl
                label="Homepage"
                help="Will be shown on the homepage"
                checked={context.homepage}
                onChange={onChangeHandler}
            />
            <CheckboxControl
                label="Latest"
                help='Will be shown in the list of articles (currently "/blog")'
                checked={context.latest}
                onChange={onChangeHandler}
            />
        </>
    )
}

export default PublicationContext
