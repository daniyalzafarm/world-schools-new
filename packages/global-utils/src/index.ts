// Currency utils are intentionally NOT re-exported from this barrel: it also
// exports the server-only email service (nodemailer/@nestjs), and pulling that
// into a frontend bundle breaks SSR. Import currency helpers from the
// dedicated subpath instead: `@world-schools/global-utils/currency`.
export * from './lib/email.service'
export * from './lib/email.types'
