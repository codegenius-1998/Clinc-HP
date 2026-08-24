import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "./client";
import { HONESTY_RULES, MEDICAL_AD_GUIDELINE_RULES } from "@/lib/site/authoringRules";

/** Tidies the free-text comment each staff member supplied on the hearing sheet into presentable
 * on-page copy.
 *
 * These comments arrive as notes typed into a form — fragments, no punctuation, inconsistent
 * politeness between one member and the next — and were previously placed on the page exactly as
 * received, so a staff section read as a list of memos rather than as introductions.
 *
 * Names and roles are NOT sent for rewriting; only the comment text is. And the rewrite may only
 * rephrase: any qualification, year count or achievement not already in the clinic's own words would
 * be an invented fact about a real, named person (see HONESTY_RULES).
 *
 * Never throws. Any failure — the API, a short response, a mismatched length — returns the original
 * comments, because shipping the clinic's own words unpolished is always better than shipping
 * nothing or shipping someone else's. */

const resultSchema = z.object({
  comments: z.array(z.string()),
});

function buildSystemPrompt(): string {
  return `あなたは日本のクリニックのホームページ原稿を整える編集者です。
スタッフが書いた自己紹介コメントの下書きを、そのまま掲載できる文章に整えてください。

# 絶対に守ること
${HONESTY_RULES.map((r) => `- ${r}`).join("\n")}
- 書かれていない事実（資格、経験年数、出身校、専門分野、実績）を足さない。
- 内容は変えない。言い回し・語尾・句読点を整えるだけ。
- 敬体（です・ます）に統一する。
- 1〜2文、40〜80字程度に収める。元が短ければ無理に伸ばさない。
- 空欄のコメントは空欄のまま返す。
- HTMLタグや記号装飾を使わない。

# 医療広告ガイドライン（触れる表現にしない）
${MEDICAL_AD_GUIDELINE_RULES.map((r) => `- ${r}`).join("\n")}

# 出力
comments には、渡された順番のまま、同じ件数だけ整えた文章を入れること。`;
}

export type StaffCommentInput = { name: string; role?: string; comment: string };

export async function polishStaffComments(members: StaffCommentInput[]): Promise<string[]> {
  const originals = members.map((m) => m.comment ?? "");
  if (originals.every((c) => c.trim().length === 0)) return originals;

  try {
    const openai = getOpenAIClient();
    const user = members
      .map((m, i) => `${i + 1}. ${m.role ? `【${m.role}】` : ""}${m.name}\n下書き: ${m.comment || "（なし）"}`)
      .join("\n\n");

    const response = await openai.responses.parse({
      model: "gpt-5.6-terra",
      input: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: user },
      ],
      text: { format: zodTextFormat(resultSchema, "staff_comments") },
    });

    const parsed = response.output_parsed as z.infer<typeof resultSchema> | null;
    // A short or long array can't be aligned to members by index, and guessing the alignment risks
    // putting one person's words under another person's name.
    if (!parsed || parsed.comments.length !== originals.length) return originals;

    return originals.map((original, i) => {
      const polished = (parsed.comments[i] ?? "").replace(/<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?\/?>/gi, "").trim();
      // An empty draft stays empty; an empty result for a non-empty draft falls back rather than
      // silently deleting what the person wrote.
      if (!original.trim()) return original;
      return polished || original;
    });
  } catch {
    return originals;
  }
}
