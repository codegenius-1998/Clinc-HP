"use client";

import { useState } from "react";
import { RESERVED_PAGE_PATHS, type PageDef, type SiteDocument } from "@/lib/site/document";
import { pageFileName } from "@/lib/site/pages";

/** Add, rename, reorder and delete the site's pages.
 *
 * ⚠️ A page's `path` IS its public URL. Renaming one on a published site breaks every inbound link
 * to it — a search result, a Google Business listing, a printed card — and nothing in this app
 * tracks those. So renaming is allowed (the clinic may simply have got it wrong) but always says so.
 *
 * ⚠️ The home page is not deletable and neither is the last remaining page. `normalizePages` would
 * repair either situation on save, but repairing it silently is worse than refusing: the clinic
 * would press delete, see something else happen, and not know what. */

const PATH_HINT = "半角の英小文字・数字・ハイフンのみ";

function isValidPath(path: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path);
}

export function PagePanel({
  doc,
  currentPageId,
  onSelect,
  onChange,
}: {
  doc: SiteDocument;
  currentPageId: string;
  onSelect: (pageId: string) => void;
  onChange: (next: (current: SiteDocument) => SiteDocument) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftPath, setDraftPath] = useState("");

  const blockCount = (pageId: string) => doc.blocks.filter((b) => b.pageId === pageId).length;
  const taken = new Set(doc.pages.map((p) => p.path));

  const patchPage = (pageId: string, patch: Partial<PageDef>) =>
    onChange((current) => ({
      ...current,
      pages: current.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
    }));

  function addPage() {
    const label = draftLabel.trim();
    const path = draftPath.trim().toLowerCase();
    if (!label || !isValidPath(path) || taken.has(path) || RESERVED_PAGE_PATHS.has(path)) return;
    const id = `page-${Date.now().toString(36)}`;
    onChange((current) => ({
      ...current,
      pages: [...current.pages, { id, path, navLabel: label, title: "", metaDescription: "", inNav: true }],
    }));
    setDraftLabel("");
    setDraftPath("");
    setAdding(false);
    onSelect(id);
  }

  function movePage(index: number, to: number) {
    // The home page is whichever page is first, so moving something above it would silently change
    // which page is the site's front door.
    if (to < 1 || to >= doc.pages.length || index < 1) return;
    onChange((current) => {
      const pages = [...current.pages];
      const [moved] = pages.splice(index, 1);
      pages.splice(to, 0, moved);
      return { ...current, pages };
    });
  }

  function deletePage(page: PageDef, index: number) {
    if (index === 0 || doc.pages.length <= 1) return;
    const count = blockCount(page.id);
    const message =
      count > 0
        ? `「${page.navLabel}」を削除します。このページの${count}個のセクションも一緒に削除されます。よろしいですか？`
        : `「${page.navLabel}」を削除します。よろしいですか？`;
    if (!window.confirm(message)) return;
    onChange((current) => ({
      ...current,
      pages: current.pages.filter((p) => p.id !== page.id),
      // Deleted along with the page rather than moved to the top page: eight sections silently
      // appearing on the home page is a worse surprise than the deletion the clinic just asked for.
      blocks: current.blocks.filter((b) => b.pageId !== page.id),
    }));
    if (currentPageId === page.id) onSelect(current0(doc));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-relaxed text-slate-400">
        ページを追加すると、それぞれが別のURLで公開されます。上のタブで切り替えて、ページごとに中身を編集できます。
      </p>

      <ul className="flex flex-col gap-1.5">
        {doc.pages.map((page, index) => {
          const isHome = index === 0;
          const active = page.id === currentPageId;
          return (
            <li
              key={page.id}
              className={`rounded-xl border px-3 py-2.5 transition-colors ${
                active ? "border-slate-900 bg-white" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelect(page.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[13px] text-slate-800">
                    {page.navLabel || "（名前なし）"}
                    {isHome && <span className="ml-1.5 text-[11px] text-slate-400">トップ</span>}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-slate-400">
                    /{page.path} · {blockCount(page.id)}セクション
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => movePage(index, index - 1)}
                    disabled={index <= 1}
                    aria-label="上へ"
                    className="rounded px-1.5 py-0.5 text-[12px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => movePage(index, index + 1)}
                    disabled={isHome || index === doc.pages.length - 1}
                    aria-label="下へ"
                    className="rounded px-1.5 py-0.5 text-[12px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePage(page, index)}
                    disabled={isHome || doc.pages.length <= 1}
                    aria-label="削除"
                    className="rounded px-1.5 py-0.5 text-[12px] text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {active && (
                <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500">メニューに出す名前</span>
                    <input
                      value={page.navLabel}
                      onChange={(e) => patchPage(page.id, { navLabel: e.target.value })}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-slate-400"
                    />
                  </label>

                  {!isHome && (
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-500">URL（{PATH_HINT}）</span>
                      <input
                        value={page.path}
                        onChange={(e) => patchPage(page.id, { path: e.target.value.toLowerCase() })}
                        className={`rounded-lg border px-2.5 py-1.5 font-mono text-[13px] outline-none focus:border-slate-400 ${
                          isValidPath(page.path) ? "border-slate-200" : "border-rose-300 bg-rose-50"
                        }`}
                      />
                      <span className="text-[11px] text-amber-600">
                        ⚠️ 公開済みのページのURLを変えると、以前のURLは開けなくなります。
                      </span>
                    </label>
                  )}

                  <label className="flex items-center gap-2 text-[12px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={page.inNav}
                      onChange={(e) => patchPage(page.id, { inNav: e.target.checked })}
                      className="h-3.5 w-3.5"
                    />
                    メニューに表示する
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-500">ページのタイトル（空欄ならサイト共通のものを使います）</span>
                    <input
                      value={page.title}
                      onChange={(e) => patchPage(page.id, { title: e.target.value })}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-slate-400"
                    />
                  </label>

                  <p className="font-mono text-[11px] text-slate-400">公開ファイル: {pageFileName(page)}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500">メニューに出す名前</span>
            <input
              autoFocus
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="診療案内"
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-slate-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500">URL（{PATH_HINT}）</span>
            <input
              value={draftPath}
              onChange={(e) => setDraftPath(e.target.value.toLowerCase())}
              placeholder="service"
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-[13px] outline-none focus:border-slate-400"
            />
          </label>
          {draftPath.length > 0 && !isValidPath(draftPath) && (
            <p className="text-[11px] text-rose-600">{PATH_HINT}で入力してください。</p>
          )}
          {taken.has(draftPath) && <p className="text-[11px] text-rose-600">そのURLは既に使われています。</p>}
          {RESERVED_PAGE_PATHS.has(draftPath) && (
            <p className="text-[11px] text-rose-600">そのURLはシステムが使うため指定できません。</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addPage}
              disabled={!draftLabel.trim() || !isValidPath(draftPath) || taken.has(draftPath) || RESERVED_PAGE_PATHS.has(draftPath)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] text-white disabled:opacity-40"
            >
              追加
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg px-3 py-1.5 text-[13px] text-slate-500 hover:text-slate-800"
            >
              やめる
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-[13px] text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          ＋ ページを追加
        </button>
      )}

      <p className="text-[11px] leading-relaxed text-slate-400">
        追加・削除・URLの変更は「保存」を押すまで公開ページには反映されません。
      </p>
    </div>
  );
}

/** The page to fall back to after deleting the one being edited. */
function current0(doc: SiteDocument): string {
  return doc.pages[0].id;
}
