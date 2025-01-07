import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faLightbulb } from "@fortawesome/free-solid-svg-icons"

export const Help = ({
    title,
    content,
}: {
    title: string | null
    content: string | null
}) => {
    return (
        <div className="wp-block-help">
            <div className="icon">
                <FontAwesomeIcon icon={faLightbulb} />
            </div>
            <div>
                {title ? <h4>{title}</h4> : null}
                <div
                    className="content"
                    dangerouslySetInnerHTML={{ __html: content || "" }}
                ></div>
            </div>
        </div>
    )
}
