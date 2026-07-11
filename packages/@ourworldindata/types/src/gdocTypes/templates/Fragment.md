---
skeleton:
    - name: The shared content
      description:
          Freeform body — prose and headings shaped by whatever the consuming
          documents need. Fragments have no canonical structure of their own.
      components: [text, heading]
---

Reusable content that is not published as a standalone page: fragments hold
shared material other documents pull in — most commonly the details-on-demand
dictionary and the FAQ content used by data pages.

## When to use

- Content referenced from other documents or systems rather than read in
  place.

## Limitations

- The `details` and `faqs` front-matter structures that most existing
  fragments are built around are not yet supported by the ArchieML
  write-back — those fragments must be edited in Google Docs directly. The
  write API refuses such edits rather than losing the content.
