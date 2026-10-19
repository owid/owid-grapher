# Transactional email templates

Generated files — do not edit by hand.

The templates are React Email components in `baker/emailNotifications/`
(`WelcomeEmail.tsx`, `MagicLinkEmail.tsx`), rendered once with
`{{placeholder}}` props and committed here so the Cloudflare functions can
send them without bundling React Email. `functions/_common/emailTemplates.ts`
fills the placeholders per recipient.

After changing a template or the shared layout, run

```
yarn buildTransactionalEmailTemplates
```

and commit the result. `baker/emailNotifications/transactionalEmailTemplates.test.ts`
fails when these files are out of date.
