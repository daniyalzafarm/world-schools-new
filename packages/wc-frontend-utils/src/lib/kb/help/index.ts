/**
 * Shared Help (KB) module for wc-booking, wc-provider, wc-superadmin.
 * Apps must wrap help routes with HelpKbProvider and import kb-classes.css in globals.css.
 */

export {
  createKbHelpService,
  type KbHelpApiClient,
  type KbHelpContext,
  type KbHelpService,
} from './create-kb-help-service'
export {
  HelpKbProvider,
  useHelpKb,
  type HelpKbConfig,
  type HelpKbContextValue,
  type HelpKbProviderProps,
} from './help-kb-context'
export { articleTypeLabel } from './article-type-label'
export { HelpContactCta, type HelpContactCtaProps } from './help-contact-cta'
export { highlightSearchText } from './highlight-search-text'
export { getOrCreateFeedbackSessionId, FEEDBACK_SESSION_KEY } from './feedback-session'
export { HelpHomePageContent } from './HelpHomePageContent'
export { HelpSearchPageContent } from './HelpSearchPageContent'
export { HelpCategoryPageContent } from './HelpCategoryPageContent'
export { HelpArticlePageContent } from './HelpArticlePageContent'
