import type { HearingSheet } from "@/lib/hearing";

/** Shows what the automatic design check found at the end of the last build.
 *
 * A count, not a list: the detail is a click away in the editor, and what an admin scanning a table
 * needs to know is only whether this one site needs looking at. Renders nothing at all when a build
 * has never run or predates the check — an empty cell reads as "not applicable", whereas a "0件"
 * badge on an unchecked site would be a lie.
 *
 * ⚠️ The counts are a snapshot of the build. Editing a site afterwards does not update them, which is
 * why the editor re-runs the check live rather than showing this number. */
export function DesignCheckBadge({ check }: { check: HearingSheet["designCheck"] }) {
  if (!check) return null;

  if (check.high > 0) {
    return (
      <span className="whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-[12px] font-medium text-red-700">
        表示崩れ {check.high}件
      </span>
    );
  }
  if (check.medium > 0) {
    return (
      <span className="whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-700">
        要確認 {check.medium}件
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
      デザイン確認 済
    </span>
  );
}
