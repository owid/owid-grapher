import { describe, expect, it } from "vitest"
import { LinkedAuthor } from "@ourworldindata/types"
import { addTeamPagePhotos } from "./DatapageHelpers.js"

const updatedAt = new Date("2026-10-01")

const author = (
    name: string,
    slug: string,
    featuredImage: string | null
): LinkedAuthor => ({ name, slug, featuredImage, updatedAt })

const teamPagePhotos = [
    { name: "Mojmír Vinkler", image: "MojmirVinkler.jpg", updatedAt },
    { name: "Dr. Bastian Herre", image: "BastianHerre.jpg", updatedAt },
]

describe(addTeamPagePhotos, () => {
    it("keeps author page photos as they are", () => {
        const authors = [author("Fiona Spooner", "fiona-spooner", "fiona.jpg")]

        expect(
            addTeamPagePhotos(authors, ["Fiona Spooner"], teamPagePhotos)
        ).toEqual(authors)
    })

    it("adds the team page photo for someone with no author page, linking them to the team page", () => {
        expect(
            addTeamPagePhotos([], ["Mojmír Vinkler"], teamPagePhotos)
        ).toEqual([author("Mojmír Vinkler", "", "MojmirVinkler.jpg")])
    })

    it("fills a photo-less author page from the team page, matching across titles", () => {
        expect(
            addTeamPagePhotos(
                [author("Bastian Herre", "bastian-herre", null)],
                ["Bastian Herre"],
                teamPagePhotos
            )
        ).toEqual([
            author("Bastian Herre", "bastian-herre", "BastianHerre.jpg"),
        ])
    })

    it("leaves out people with neither, so they show initials", () => {
        expect(addTeamPagePhotos([], ["Lars Yencken"], teamPagePhotos)).toEqual(
            []
        )
    })
})
