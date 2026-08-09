import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

export type CloudflareDeployResult = {
  url: string;
  rawOutput: string;
};

const DEPLOY_URL_PATTERN = /https:\/\/[a-z0-9.-]+\.pages\.dev\S*/i;

/** Deploys a generated static site directory to Cloudflare Pages via `wrangler pages deploy`. Requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (or a prior `wrangler login`) in the environment. */
export async function deployGeneratedSiteToCloudflare(slug: string): Promise<CloudflareDeployResult> {
  const dir = path.join(process.cwd(), "public", "generated", slug);
  const projectName = `clinc-hp-${slug}`.slice(0, 58);

  try {
    const { stdout, stderr } = await execFileAsync(
      "npx",
      ["wrangler", "pages", "deploy", dir, "--project-name", projectName, "--branch", "preview"],
      { cwd: process.cwd(), timeout: 5 * 60 * 1000 }
    );
    const output = `${stdout}\n${stderr}`;
    const match = output.match(DEPLOY_URL_PATTERN);
    if (!match) {
      throw new Error("Cloudflareへのデプロイは実行されましたが、プレビューURLを取得できませんでした。");
    }
    return { url: match[0], rawOutput: output };
  } catch (err) {
    if (err && typeof err === "object" && "stdout" in err) {
      const e = err as { stdout?: string; stderr?: string; message: string };
      throw new Error(
        `Cloudflareへのデプロイに失敗しました: ${e.stderr || e.message}\n\nCLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID が .env.local に設定されているか、事前に "wrangler login" が実行されているか確認してください。`
      );
    }
    throw err;
  }
}
