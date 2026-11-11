import { describe, expect, it } from "vitest"
import {
    buildOwidBriefRecord,
    isOwidBriefCampaign,
    MailchimpCampaign,
} from "./owidBrief.js"

const brief: MailchimpCampaign = {
    id: "abc123",
    send_time: "2026-10-16T17:00:00+00:00",
    long_archive_url: "https://mailchi.mp/ourworldindata/jbyb81d146",
    settings: {
        title: "The OWID Brief 16 Oct 2026",
        subject_line: "The OWID Brief: Wildlife populations, and more",
    },
}

describe(isOwidBriefCampaign, () => {
    it("tells the Brief apart from the other newsletters sent to the same audience", () => {
        const dataInsight: MailchimpCampaign = {
            ...brief,
            settings: {
                title: "Data Insight",
                subject_line: "Data Insight: Beef production",
            },
        }
        const untitled: MailchimpCampaign = { ...brief, settings: {} }

        expect(isOwidBriefCampaign(brief)).toBe(true)
        expect(isOwidBriefCampaign(dataInsight)).toBe(false)
        expect(isOwidBriefCampaign(untitled)).toBe(false)
    })
})

describe(buildOwidBriefRecord, () => {
    it("builds a newsletter record that links to the archived issue", () => {
        expect(buildOwidBriefRecord(brief)).toEqual({
            objectID: "mailchimp-campaign-abc123",
            slug: "abc123",
            title: "The OWID Brief: Wildlife populations, and more",
            excerpt: "",
            date: "2026-10-16T17:00:00.000Z",
            modifiedDate: "2026-10-16T17:00:00.000Z",
            authors: [],
            tags: [],
            thumbnailUrl: "",
            type: "newsletter",
            latestType: "newsletter",
            url: "https://mailchi.mp/ourworldindata/jbyb81d146",
        })
    })

    it("titles an A/B-tested issue with its first subject line variant", () => {
        const record = buildOwidBriefRecord({
            ...brief,
            settings: { title: "The OWID Brief 30 Oct 2026" },
            variate_settings: {
                subject_lines: [
                    "The OWID Brief: Mental health, and more",
                    "The OWID Brief: When do people experience mental health conditions?",
                ],
            },
        })

        expect(record?.title).toBe("The OWID Brief: Mental health, and more")
    })
})
