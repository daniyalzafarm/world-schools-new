import { render } from '@react-email/render'
import { createElement, type ComponentType } from 'react'

export interface RenderedEmail {
  html: string
  /** Plain-text alternative for multi-part MIME. Empty string when not requested. */
  text: string
}

export interface RenderOptions {
  /** Produce a plain-text version alongside HTML. Defaults to true. */
  includePlainText?: boolean
}

/**
 * Render a React Email template component to HTML (and optionally plain text).
 *
 * Send logic is intentionally separate — this function knows nothing about
 * recipients, queues, or nodemailer. Pair the returned `{ html, text }` with
 * `EmailService.sendEmail` at the worker layer.
 */
export async function renderEmail<TProps extends object>(
  Component: ComponentType<TProps>,
  props: TProps,
  options: RenderOptions = {}
): Promise<RenderedEmail> {
  const { includePlainText = true } = options
  const element = createElement(Component, props)
  const html = await render(element, { pretty: false })
  const text = includePlainText ? await render(element, { plainText: true }) : ''
  return { html, text }
}
