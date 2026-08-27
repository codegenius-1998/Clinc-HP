import { createElement } from "react";
import { SitePage } from "./components";
import type { SiteDocument } from "@/lib/site/document";

/** Turns a SiteDocument into a complete, static HTML document string.
 *
 * `react-dom/server` is imported dynamically rather than statically: this module is reachable from a
 * `"use server"` Server Action (saveDocumentAction -> renderSiteFiles -> renderSiteHtml), and
 * Next.js's bundler flatly refuses a static `react-dom/server` import anywhere in that reachability
 * graph ("You're importing a component that imports react-dom/server..."). We're not rendering a
 * Next.js page here at all — just serializing a plain React element tree to a standalone static HTML
 * file — so a dynamic import is the correct escape hatch, not a workaround for a real problem.
 *
 * One call renders ONE page of the document. `pageId` defaults to the first page, which for a
 * one-page document is the only one — so every existing caller keeps working unchanged. */
export async function renderSiteHtml(doc: SiteDocument, pageId: string = doc.pages[0].id): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(createElement(SitePage, { doc, pageId }));
  return `<!DOCTYPE html>\n${markup}\n`;
}
