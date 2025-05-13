import * as _ from "lodash-es"
import { removeDiacritics } from "@ourworldindata/utils"
import { useDonors } from "../utils.js"

function* generateTestimonials() {
    yield "Our World in Data is a profound source of information and inspiration for solving global problems. Thank you."
    yield "To me, investing in evidence-based solutions to both combat and prevent disasters is one of the smartest things we can do for humanity. That's why I've become a monthly donor to Our World in Data!"
    yield "Our World in Data is a tremendous resource to help the general public and policymakers be objective about the problems we're facing and also the success we've had so far."
    yield "The research produced by Our World in Data has the potential to make a real difference in the world. By shedding light on issues such as poverty, inequality, and health, they can help policymakers, researchers, and activists make informed decisions that improve people's lives."
    yield "Simply the best, most accessible and reliable source for some of the most important data about our world."
    yield "Our World in Data constantly challenges my thinking in the best possible ways. The world is smarter for this site."
    yield "Your work with facts is essential in this chaotic world. It is also extremely well-presented and concise enough for people to be able to read even if they are in a hurry."
    yield "Thanks for everything you do. I use your work about once a week in my undergraduate lectures."
    yield "Clear facts for everyone on the planet."
    yield "A wide-ranging curated set of data that is presented well and made available for all to use. Truly a service to and for the world we live in."
    yield "Your work is invaluable towards creating a better and more just world. Thank you!"
    yield "It seems every time I visit your page I learn something fascinating. Thank you for the eye-opening and engaging content."
}

function Testimonials({
    testimonials,
}: {
    testimonials: (string | undefined)[]
}) {
    const [first, second] = testimonials
    if (!first) return null
    return (
        <>
            <h4 className="h5-black-caps">From our readers</h4>
            <div className="donor-testimonials">
                <blockquote className="donor-testimonial">
                    <p>{`“${first}”`}</p>
                </blockquote>
                {second && (
                    <blockquote className="donor-testimonial">
                        <p>{`“${second}”`}</p>
                    </blockquote>
                )}
            </div>
        </>
    )
}

export default function Donors({ className }: { className?: string }) {
    const donors = useDonors()
    if (!donors) return null

    const donorsByLetter = _.groupBy(donors, (donor) =>
        removeDiacritics(donor[0].toUpperCase())
    )
    const testimonialGenerator = generateTestimonials()
    return (
        <div className={className}>
            <div className="col-start-2 span-cols-12">
                <p className="donors-note">(Listed in alphabetical order)</p>
                {Object.entries(donorsByLetter).map(
                    ([letter, donors], index) => (
                        <div key={letter}>
                            <h3 className="donors-letter">{letter}</h3>
                            <ul className="donor-list">
                                {donors.map((donor) => (
                                    <li key={donor} className="donor-item">
                                        {donor}
                                    </li>
                                ))}
                            </ul>
                            {index % 4 === 0 && (
                                <Testimonials
                                    testimonials={[
                                        testimonialGenerator.next().value ||
                                            undefined,
                                        testimonialGenerator.next().value ||
                                            undefined,
                                    ]}
                                />
                            )}
                        </div>
                    )
                )}
            </div>
        </div>
    )
}
