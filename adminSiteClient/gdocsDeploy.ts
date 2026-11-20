import * as _ from "lodash-es"
import { OwidGdoc } from "@ourworldindata/types"
import { match } from "ts-pattern"
import { GDOC_DIFF_OMITTABLE_PROPERTIES } from "./constants.js"

export const checkHasChanges = (prevGdoc: OwidGdoc, nextGdoc: OwidGdoc) =>
    !_.isEqual(
        _.omit(
            {
                ...prevGdoc,
                tags: prevGdoc.tags?.map((tag) => JSON.stringify(tag)),
            },
            GDOC_DIFF_OMITTABLE_PROPERTIES
        ),
        _.omit(
            {
                ...nextGdoc,
                tags: nextGdoc.tags?.map((tag) => JSON.stringify(tag)),
            },
            GDOC_DIFF_OMITTABLE_PROPERTIES
        )
    )

export enum GdocPublishingAction {
    Updating = "Updating",
    Publishing = "Publishing",
    Unpublishing = "Unpublishing",
    SavingDraft = "SavingDraft",
}

export function getPublishingAction(
    prevJson: OwidGdoc,
    nextJson: OwidGdoc
): GdocPublishingAction {
    return match([prevJson.published, nextJson.published])
        .with([true, true], () => GdocPublishingAction.Updating)
        .with([false, true], () => GdocPublishingAction.Publishing)
        .with([true, false], () => GdocPublishingAction.Unpublishing)
        .with([false, false], () => GdocPublishingAction.SavingDraft)
        .exhaustive()
}
