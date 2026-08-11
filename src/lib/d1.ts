/** Minimal client for the Cloudflare D1 HTTP API (https://api.cloudflare.com), used instead of a
 * Workers binding since this app runs as a normal Next.js/Node server, not on Cloudflare Workers. */

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;

type D1QueryResult<T> = {
  results: T[];
  success: boolean;
  meta: { changes: number; last_row_id: number; rows_read: number; rows_written: number };
};

/** Runs a single parameterized SQL statement against the D1 database via the REST API. */
export async function d1Query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<D1QueryResult<T>> {
  if (!accountId || !apiToken || !databaseId) {
    throw new Error("Cloudflare D1が設定されていません（CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / CLOUDFLARE_D1_DATABASE_ID を確認してください）。");
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  const body = await res.json();
  if (!res.ok || !body.success) {
    const message = body.errors?.map((e: { message: string }) => e.message).join("; ") || res.statusText;
    throw new Error(`D1クエリに失敗しました: ${message}`);
  }

  // The API returns an array of results (one per statement); we only ever send one statement.
  return body.result[0] as D1QueryResult<T>;
}
