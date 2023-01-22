import { ClientSettings } from "./clientSettings.js"

export {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
    FASTTRACK_URL,
    GDOCS_BASIC_ARTICLE_TEMPLATE_URL,
    GDOCS_CLIENT_EMAIL,
    TOPICS_CONTENT_GRAPH,
    WORDPRESS_URL,
} from "./clientSettings.js"

const defaults = {
    BAKED_BASE_URL: "http://localhost:3030",
    BAKED_GRAPHER_URL: "http://localhost:3030/grapher",
    FASTTRACK_URL: "http://owid-analytics:8083/",
    GDOCS_BASIC_ARTICLE_TEMPLATE_URL: "",
    GDOCS_CLIENT_EMAIL: "",
    TOPICS_CONTENT_GRAPH: false,
    WORDPRESS_URL: "",
}

export type AdminClientSettingsObject = typeof defaults

export class AdminClientSettings extends ClientSettings<AdminClientSettingsObject> {
    constructor(settings: Record<string, unknown>) {
        super(defaults, settings)
    }
}
