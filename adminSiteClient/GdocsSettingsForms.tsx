import {
    OwidGdocPostInterface,
    OwidGdocErrorMessage,
    OwidGdocDataInsightInterface,
    OwidGdoc,
    OwidGdocHomepageInterface,
    OwidGdocAuthorInterface,
    OwidGdocAboutInterface,
    OwidGdocAnnouncementInterface,
} from "@ourworldindata/utils"
import { EXCERPT_MAX_LENGTH } from "./gdocsValidation.js"
import { GdocsSlug } from "./GdocsSlug.js"
import {
    GdocsSettingsContentField,
    GdocsSettingsTextArea,
} from "./GdocsSettingsContentField.js"
import { GdocsPublishedAt } from "./GdocsDateline.js"
import { GdocsPublicationContext } from "./GdocsPublicationContext.js"
import { Alert } from "antd"
import { GdocsManualBreadcrumbsInput } from "./GdocsManualBreadcrumbsInput.js"

const GdocCommonErrors = ({
    errors,
    errorsToFilter,
}: {
    errors: OwidGdocErrorMessage[]
    errorsToFilter: string[]
}) => {
    const commonErrorsToFilter = ["title", "authors", "publishedAt", "slug"]
    const errorsToShowInDrawer = errors.filter(
        ({ property }) =>
            ![...commonErrorsToFilter, ...errorsToFilter].includes(property)
    )
    return (
        <>
            {errorsToShowInDrawer.map((error, index) => (
                <Alert
                    key={index}
                    className="GdocsSettingsForm__alert"
                    message={error.message}
                    type={error.type}
                    showIcon
                />
            ))}
        </>
    )
}

const GdocCommonSettings = <T extends OwidGdoc>({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: T
    setCurrentGdoc: (gdoc: T) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    return (
        <div className="form-group">
            <h3 className="form-section-heading">Common settings</h3>
            <GdocsSettingsContentField
                property="title"
                gdoc={gdoc}
                errors={errors}
            />
            <GdocsSettingsContentField
                property="authors"
                gdoc={gdoc}
                errors={errors}
            />
            <GdocsSlug
                gdoc={gdoc}
                setCurrentGdoc={setCurrentGdoc}
                errors={errors}
            />
            <GdocsPublishedAt
                gdoc={gdoc}
                setCurrentGdoc={setCurrentGdoc}
                errors={errors}
            />
        </div>
    )
}

export const GdocPostSettings = ({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: OwidGdocPostInterface
    setCurrentGdoc: (gdoc: OwidGdocPostInterface) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    if (!gdoc || !errors) return null
    return (
        <form className="GdocsSettingsForm">
            <GdocCommonErrors
                errors={errors}
                errorsToFilter={[
                    "excerpt",
                    "cover-image",
                    "featured-image",
                    "atom-title",
                    "atom-excerpt",
                ]}
            />
            <GdocCommonSettings
                gdoc={gdoc}
                setCurrentGdoc={setCurrentGdoc}
                errors={errors}
            />
            <div className="form-group">
                <h3 className="form-section-heading">Post settings</h3>
                <GdocsSettingsContentField
                    property="excerpt"
                    gdoc={gdoc}
                    errors={errors}
                    render={(props) => (
                        <GdocsSettingsTextArea
                            {...props}
                            inputProps={{
                                showCount: true,
                                maxLength: EXCERPT_MAX_LENGTH,
                            }}
                        />
                    )}
                />
                <GdocsSettingsContentField
                    property="cover-image"
                    gdoc={gdoc}
                    errors={errors}
                />
                <GdocsSettingsContentField
                    property="featured-image"
                    gdoc={gdoc}
                    errors={errors}
                />

                <GdocsSettingsContentField
                    property="dateline"
                    gdoc={gdoc}
                    errors={errors}
                />
                <GdocsPublicationContext
                    gdoc={gdoc}
                    setCurrentGdoc={setCurrentGdoc}
                />
                <GdocsSettingsContentField
                    property="atom-title"
                    gdoc={gdoc}
                    errors={errors}
                    description="An optional property to override the title of this post in our atom feed, which is used for the newsletter"
                />
                <GdocsSettingsContentField
                    property="atom-excerpt"
                    gdoc={gdoc}
                    errors={errors}
                    description="An optional property to override the excerpt of this post in our atom feed, which is used for the newsletter"
                />
                <GdocsManualBreadcrumbsInput
                    gdoc={gdoc}
                    errors={errors}
                    setCurrentGdoc={setCurrentGdoc}
                />
            </div>
        </form>
    )
}

export const GdocInsightSettings = ({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: OwidGdocDataInsightInterface
    setCurrentGdoc: (gdoc: OwidGdocDataInsightInterface) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    if (!gdoc || !errors) return null

    return (
        <form className="GdocsSettingsForm">
            <GdocCommonErrors
                errors={errors}
                errorsToFilter={[
                    "approved-by",
                    "grapher-url",
                    "narrative-chart",
                    "figma-url",
                ]}
            />
            <GdocCommonSettings
                gdoc={gdoc}
                setCurrentGdoc={setCurrentGdoc}
                errors={errors}
            />
            <div className="form-group">
                <h3 className="form-section-heading">Data insight settings</h3>
                <GdocsSettingsContentField
                    property="approved-by"
                    gdoc={gdoc}
                    errors={errors}
                />
                <GdocsPublicationContext
                    gdoc={gdoc}
                    setCurrentGdoc={setCurrentGdoc}
                />
                <GdocsSettingsContentField
                    property="narrative-chart"
                    gdoc={gdoc}
                    errors={errors}
                />
                <GdocsSettingsContentField
                    property="grapher-url"
                    gdoc={gdoc}
                    errors={errors}
                />
                <GdocsSettingsContentField
                    property="figma-url"
                    gdoc={gdoc}
                    errors={errors}
                />
            </div>
        </form>
    )
}

export const GdocAnnouncementSettings = ({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: OwidGdocAnnouncementInterface
    setCurrentGdoc: (gdoc: OwidGdocAnnouncementInterface) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    if (!gdoc || !errors) return null

    return (
        <form className="GdocsSettingsForm">
            <GdocCommonErrors
                errors={errors}
                errorsToFilter={[
                    "approved-by",
                    "grapher-url",
                    "narrative-chart",
                    "figma-url",
                ]}
            />
            <GdocCommonSettings
                gdoc={gdoc}
                setCurrentGdoc={setCurrentGdoc}
                errors={errors}
            />
            <div className="form-group">
                <h3 className="form-section-heading">Announcement settings</h3>
                <GdocsSettingsContentField
                    property="kicker"
                    gdoc={gdoc}
                    errors={errors}
                />
            </div>
        </form>
    )
}

export const GdocHomepageSettings = ({
    gdoc,
    errors,
}: {
    gdoc: OwidGdocHomepageInterface
    errors?: OwidGdocErrorMessage[]
}) => {
    if (!gdoc || !errors) return null
    return (
        <div className="GdocsSettingsForm">
            <GdocCommonErrors errors={errors} errorsToFilter={[]} />
            <div className="form-group">
                <h3 className="form-section-heading">Homepage settings</h3>
                <p>The homepage has no custom authors, slug, title, etc.</p>
                <p>Just hit publish when you'd like to update the page!</p>
            </div>
        </div>
    )
}

export const GdocAuthorSettings = ({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: OwidGdocAuthorInterface
    setCurrentGdoc: (gdoc: OwidGdocAuthorInterface) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    if (!gdoc || !errors) return null
    return (
        <div className="GdocsSettingsForm">
            <GdocCommonErrors errors={errors} errorsToFilter={[]} />
            <div className="form-group">
                <h3 className="form-section-heading">Common settings</h3>
                <GdocsSettingsContentField
                    property="title"
                    gdoc={gdoc}
                    errors={errors}
                />
                <GdocsSlug
                    gdoc={gdoc}
                    setCurrentGdoc={setCurrentGdoc}
                    errors={errors}
                />
            </div>
            <div className="form-group">
                <h3 className="form-section-heading">Author settings</h3>
                <GdocsSettingsContentField
                    property="role"
                    gdoc={gdoc}
                    errors={errors}
                />
            </div>
        </div>
    )
}

export const GdocAboutPageSettings = ({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: OwidGdocAboutInterface
    setCurrentGdoc: (gdoc: OwidGdocAboutInterface) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    if (!gdoc || !errors) return null
    return (
        <div className="GdocsSettingsForm">
            <GdocCommonErrors errors={errors} errorsToFilter={[]} />
            <div className="form-group">
                <h3 className="form-section-heading">Common settings</h3>
                <GdocsSettingsContentField
                    property="title"
                    gdoc={gdoc}
                    errors={errors}
                />
                <GdocsSlug
                    gdoc={gdoc}
                    setCurrentGdoc={setCurrentGdoc}
                    errors={errors}
                />
            </div>
            <div className="form-group">
                <h3 className="form-section-heading">About page settings</h3>
                <GdocsSettingsContentField
                    property="hide-nav"
                    gdoc={gdoc}
                    errors={errors}
                />
                <GdocsSettingsContentField
                    property="override-title"
                    gdoc={gdoc}
                    errors={errors}
                />
            </div>
        </div>
    )
}
