import { createElement } from "react";
import { SitePage } from "./components";
import type { SiteViewModel } from "./types";

/** Turns a fully-resolved SiteViewModel into a complete, static HTML document string. This is the
 * one place cheerio-style DOM surgery used to live — now it's just React rendering a component tree
 * to a string, so there's no pre-existing markup to keep in sync and nothing can drift out of shape.
 *
 * `react-dom/server` is imported dynamically rather than statically: this module is reachable from a
 * `"use server"` Server Action (createHearingAction -> generateSite -> renderSiteHtml), and Next.js's
 * bundler flatly refuses a static `react-dom/server` import anywhere in that reachability graph
 * ("You're importing a component that imports react-dom/server..."). We're not rendering a Next.js
 * page here at all — just serializing a plain React element tree to a standalone static HTML file —
 * so a dynamic import is the correct escape hatch, not a workaround for a real problem. */
export async function renderSiteHtml(vm: SiteViewModel): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(createElement(SitePage, { vm }));
  return `<!DOCTYPE html>\n${markup}\n`;
}
