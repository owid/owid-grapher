// Todo: ensure entityCodeOrName never contain the v2Delimiter
declare type entityCodeOrName = string

export class EntityUrlBuilder {
    private static v1Delimiter = "+"
    private static v2Delimiter = "~"

    static entitiesToQueryParam(entities: entityCodeOrName[]) {
        // Always include a v2Delimiter in a v2 link. When decoding we will drop any empty strings.
        if (entities.length === 1)
            return encodeURIComponent(this.v2Delimiter + entities[0])

        return encodeURIComponent(entities.join(this.v2Delimiter))
    }

    static queryParamToEntities(queryParam: string) {
        // First preserve handling of the old v1 country=USA+FRA style links. If a link does not
        // include a v2Delimiter and includes a + we assume it's a v1 link. Unfortunately link sharing
        // with v1 links did not work on Facebook because FB would replace %20 with "+".
        return this.isV1Link(queryParam)
            ? this.decodeV1Link(queryParam)
            : this.decodeV2Link(queryParam)
    }

    private static isV1Link(queryParam: string) {
        // No entities currently have a v2Delimiter in their name so if a v2Delimiter is present we know it's a v2 link.
        return !decodeURIComponent(queryParam).includes(this.v2Delimiter)
    }

    private static decodeV1Link(queryParam: string) {
        return queryParam.split(this.v1Delimiter).map(decodeURIComponent)
    }

    private static decodeV2Link(queryParam: string) {
        // Facebook turns %20 into +. v2 links will never contain a +, so we can safely replace all of them with %20.
        return decodeURIComponent(queryParam.replace(/\+/g, "%20"))
            .split(this.v2Delimiter)
            .filter((item) => item)
    }

    // If an entity has the old name-dimension encoding, try removing the dimension part. So USA-1 becomes USA.
    private static replaceDimensionStr(entity: string) {
        return entity.replace(/\-\d+$/, "")
    }

    /**
     * URLs may contain the selected entities by code or by their full name. In addition, some old urls contain a selection+dimension index combo. This methods
     * handles those situations.
     */
    static scanUrlForEntityNames(
        selectedEntitiesInQueryParam: string[],
        codeToNameMap: Map<string, string>,
        availableEntityNameSet: Set<string>
    ) {
        const adjustedEntities = selectedEntitiesInQueryParam.map(
            (queryInput) => {
                let name = codeToNameMap.get(queryInput)
                if (name) return name

                if (availableEntityNameSet.has(queryInput)) return queryInput

                const withoutDimension = this.replaceDimensionStr(queryInput)

                name = codeToNameMap.get(withoutDimension)
                if (name) return name

                if (availableEntityNameSet.has(withoutDimension))
                    return withoutDimension
                return queryInput
            }
        )

        const notFoundEntities = adjustedEntities.filter(
            (name) => !availableEntityNameSet.has(name)
        )
        const foundEntities = adjustedEntities.filter((name) =>
            availableEntityNameSet.has(name)
        )
        return {
            notFoundEntities,
            foundEntities,
        }
    }
}
