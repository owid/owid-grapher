## Context

Links to issues, Figma, Slack, and a technical introduction to the work.

## Screenshots / Videos / Diagrams

Add if relevant, i.e. might not be necessary when there are no UI changes.

## Testing guidance

Step-by-step instructions on how to test this change

- [ ] Does the staging experience have sign-off from product stakeholders?

**Reminder to annotate the PR diff with design notes, alternatives you considered, and any other helpful context.**

## Checklist

(delete all that do not apply)

- [ ] Google Analytics events were adapted to fit the changes in this PR
- [ ] Changes to CSS/HTML were checked on Desktop and Mobile Safari at all three breakpoints
- [ ] Changes to HTML were checked for accessibility concerns

If DB migrations exists:

- [ ] If columns have been added/deleted, all necessary views were recreated
- [ ] The DB type definitions have been updated
- [ ] The DB types in the ETL have been updated
- [ ] If tables/views were added/removed, the Datasette export has been updated to take this into account
- [ ] If a table was touched that is synced to R2, the sync script to update R2 has been run
