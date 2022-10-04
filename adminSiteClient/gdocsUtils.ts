import { OwidArticleType } from "../clientUtils/owidTypes.js"

export const getArticleFromJSON = (json: any): OwidArticleType => {
    return {
        ...json,
        createdAt: new Date(json.createdAt),
        publishedAt: json.publishedAt ? new Date(json.publishedAt) : null,
        updatedAt: json.updatedAt ? new Date(json.updatedAt) : null,
    }
}
