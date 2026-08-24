/** The single list of image formats this app accepts, shared by the upload endpoint and the editor's
 * adopt step.
 *
 * It lives in its own module because those two used to keep separate lists and drifted apart:
 * POST /api/uploads accepted anything whose MIME type started with "image/", while adoptImageAction
 * recognised only five types. An iPhone photo (HEIC) therefore uploaded successfully, was stored in
 * Supabase, and only then failed with "対応していない画像形式です（image/heic）" — the user saw the
 * upload work and the result never appear. Rejecting at the door, from one list, makes that
 * impossible.
 *
 * Membership is "formats a browser can actually display on the published site", which is why HEIC
 * and TIFF are absent even though they are perfectly good photo formats. */
export const IMAGE_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

export function imageExtensionFor(contentType: string): string | undefined {
  return IMAGE_EXTENSION_BY_TYPE[contentType.split(";")[0].trim().toLowerCase()];
}

/** Formats worth naming explicitly in the error, because they are what people actually hit: HEIC/HEIF
 * is the iPhone camera default, and the rest come out of scanners and design tools. A bare
 * "対応していない形式です" leaves the user with no idea what to do next. */
const CONVERSION_HINTS: Record<string, string> = {
  "image/heic": "iPhoneの写真（HEIC形式）です",
  "image/heif": "iPhoneの写真（HEIF形式）です",
  "image/tiff": "TIFF形式です",
  "image/bmp": "BMP形式です",
  "image/x-icon": "アイコン形式です",
};

export function unsupportedImageMessage(fileName: string, contentType: string): string {
  const type = contentType.split(";")[0].trim().toLowerCase();
  const what = CONVERSION_HINTS[type];
  const head = what
    ? `${fileName} は${what}。このままではホームページに表示できません。`
    : `${fileName} は対応していない画像形式です（${type || "不明"}）。`;
  return `${head}\nJPEG・PNG・WebP・GIF のいずれかで保存し直してからアップロードしてください。\n（iPhoneの場合、写真アプリで共有 →「ファイルに保存」の前に、設定 → カメラ → フォーマット →「互換性優先」にすると JPEG で撮影できます）`;
}
