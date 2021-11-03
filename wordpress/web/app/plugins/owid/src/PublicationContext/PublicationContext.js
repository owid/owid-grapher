import { CheckboxControl } from "@wordpress/components"
const { useSelect, useDispatch } = wp.data

const PUBLICATION_CONTEXT_META_FIELD = "owid_publication_context_meta_field"
const DEFAULT = "short"

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
                    article_index: !context.article_index,
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
                label="Article index"
                help="Will be shown in the article index (front page and /blog)"
                checked={context.article_index}
                onChange={onChangeHandler}
            />
        </>
    )
}

export default PublicationContext
