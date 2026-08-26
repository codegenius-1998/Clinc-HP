import { HOME_PAGE_ID, RESERVED_PAGE_PATHS, defaultPages, type Block, type PageDef, type SiteDocument } from "./document";

/** Everything about "which page is a block on, and what does that page's nav look like".
 *
 * A page is NOT a separate document. `doc.blocks` stays one flat, ordered array and each block names
 * its page — which is what keeps `site_sections.position` a single source of truth for ordering, and
 * what lets a one-page document (every document written before this existed) keep working with no
 * migration: a block with no stored page defaults to the home page, which is where it already was.
 *
 * ⚠️ Output is FLAT: the home page is `index.html` and a page at `about` is `about.html`, both at the
 * top level of the output directory. Not `about/index.html`. Every asset the renderer emits is
 * document-relative (`css/site.css`, `js/main.js`, `images/hero.jpg`), and keeping every page at
 * depth 0 is what lets those keep working verbatim — in the local preview under
 * `/generated/<slug>/`, in the editor's iframe, and on Cloudflare Pages at the domain root. The
 * alternatives both fail somewhere: a `../` prefix would put `path.join(outDir, "../images/x.jpg")`
 * outside the output directory and break designCheck's file-existence test, and a `<base href>`
 * resolves fragment URLs too — `href="#hours"` on `/about` would become `/#hours` and navigate to
 * the home page instead of scrolling. */

/** `""` -> "index.html", "about" -> "about.html". */
export function pageFileName(page: Pick<PageDef, "path">): string {
  return page.path === "" ? "index.html" : `${page.path}.html`;
}

export function findPage(doc: SiteDocument, pageId: string): PageDef {
  return doc.pages.find((p) => p.id === pageId) ?? doc.pages[0];
}

export function homePage(doc: SiteDocument): PageDef {
  return doc.pages.find((p) => p.path === "") ?? doc.pages[0];
}

/** The visible blocks that render on one page, in document order. */
export function pageBlocks(doc: SiteDocument, pageId: string): Block[] {
  return doc.blocks.filter((b) => b.visible && b.pageId === pageId);
}

function slugifyPath(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Reconciles a page list and a block list into a pair that can always be rendered.
 *
 * Written in the same spirit as `normalizeComposition` (composition.ts) and `normalizeDesignTokens`
 * (importFromUrl.ts): it never throws, and every rule either accepts the input or falls back. It
 * runs on BOTH the read and the write path, because the invariant that matters cannot be expressed
 * in the schema:
 *
 * ⚠️ A block whose `pageId` names no page renders on NO page. On a live site that is silent content
 * loss — the section is still in the database, still in the editor's list, and simply absent from
 * every HTML file. Reassigning it to the home page is always better than dropping it.
 *
 * Returns new arrays only when something actually changed, so a document that is already valid is
 * not needlessly marked dirty by the editor. */
export function normalizePages(
  pages: PageDef[],
  blocks: Block[]
): { pages: PageDef[]; blocks: Block[]; changed: boolean } {
  let changed = false;

  let next = pages.length > 0 ? pages.map((p) => ({ ...p })) : defaultPages();
  if (next.length !== pages.length) changed = true;

  // Page ids must be unique — they are what blocks point at, so a duplicate silently merges two
  // pages' content into whichever one `find` reaches first.
  const seenIds = new Set<string>();
  next = next.filter((page) => {
    if (!page.id || seenIds.has(page.id)) {
      changed = true;
      return false;
    }
    seenIds.add(page.id);
    return true;
  });
  if (next.length === 0) {
    next = defaultPages();
    changed = true;
  }

  // Exactly one home page, and it is the first. Anything else claiming `path: ""` gets a real path,
  // because two pages both writing index.html means one of them is invisible.
  next = next.map((page, index) => {
    if (index === 0) {
      if (page.path !== "") {
        changed = true;
        return { ...page, path: "" };
      }
      return page;
    }
    if (page.path !== "") return page;
    changed = true;
    return { ...page, path: `page-${index + 1}` };
  });

  const seenPaths = new Set<string>();
  next = next.map((page, index) => {
    if (index === 0) {
      seenPaths.add("");
      return page;
    }
    let path = slugifyPath(page.path);
    if (path === "" || RESERVED_PAGE_PATHS.has(path)) path = `page-${index + 1}`;
    let candidate = path;
    for (let n = 2; seenPaths.has(candidate); n++) candidate = `${path}-${n}`;
    seenPaths.add(candidate);
    if (candidate !== page.path) {
      changed = true;
      return { ...page, path: candidate };
    }
    return page;
  });

  const known = new Set(next.map((p) => p.id));
  const home = next[0].id;
  const nextBlocks = blocks.map((block) => {
    if (known.has(block.pageId)) return block;
    changed = true;
    return { ...block, pageId: home };
  });

  return { pages: changed ? next : pages, blocks: changed ? nextBlocks : blocks, changed };
}

/** One entry in a page's navigation. `page` crosses to another HTML file; `anchor` scrolls within
 * the current one. */
export type NavItem =
  | { kind: "page"; key: string; href: string; label: string; current: boolean }
  | { kind: "anchor"; key: string; href: string; label: string };

/** The nav for one page: the site's pages, then the current page's own sections.
 *
 * ⚠️ Cross-page section anchors (`about.html#staff`) are deliberately not emitted. That is a
 * two-level menu, which is a different component — and the nav already has a one-row budget that
 * designCheck enforces at 60 characters.
 *
 * ⚠️ Back-compat: on a one-page document this reduces to "ホーム plus every navLabel", which is
 * byte-for-byte what the previous `navBlocks`-driven nav produced. */
export function navItems(doc: SiteDocument, currentPageId: string): NavItem[] {
  const items: NavItem[] = [];
  const multiPage = doc.pages.length > 1;

  for (const page of doc.pages) {
    if (!page.inNav) continue;
    // A page with nothing on it would be a link to an empty shell.
    if (pageBlocks(doc, page.id).length === 0 && page.id !== currentPageId) continue;
    const current = page.id === currentPageId;
    items.push({
      kind: "page",
      key: `page:${page.id}`,
      // The current page links to its own top rather than reloading itself.
      href: current ? "#top" : pageFileName(page),
      label: page.navLabel,
      current,
    });
    if (!multiPage) break;
  }

  for (const block of pageBlocks(doc, currentPageId)) {
    if (block.navLabel.trim().length === 0) continue;
    items.push({ kind: "anchor", key: `anchor:${block.id}`, href: `#${block.id}`, label: block.navLabel });
  }

  return items;
}

/** Where the "home" link in the header brand and the footer should point from this page. */
export function homeHref(doc: SiteDocument, currentPageId: string): string {
  const home = homePage(doc);
  return home.id === currentPageId ? "#top" : pageFileName(home);
}

export { HOME_PAGE_ID };
