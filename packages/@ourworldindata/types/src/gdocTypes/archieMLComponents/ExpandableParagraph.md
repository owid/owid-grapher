Displays a short preview of content on page load with a "Show more" button
that reveals the rest inline. Any Archie block is supported inside.

## When to use

- Keeping a long passage compact while still offering the full text inline.

## When NOT to use

- Prefer `{.expander}` when you want a distinct boxed affordance for
  large tables or technical sections.

### Basic

```archie
[.+expandable-paragraph]
Any Archie block is supported here
[]
```
