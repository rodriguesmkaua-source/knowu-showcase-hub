// Server-only: autentica no Google Drive usando uma Service Account.
// Requer o secret GOOGLE_SERVICE_ACCOUNT_JSON (JSON completo da service account).
import { createSign } from "node:crypto";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function base64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input) : input)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error(
      "Google Drive não configurado: falta o secret GOOGLE_SERVICE_ACCOUNT_JSON.",
    );
  }
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Service Account JSON inválido (falta client_email/private_key).");
    }
    // Se a private_key veio com \n escapados, normaliza:
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
  } catch (err) {
    throw new Error(
      `GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido: ${(err as Error).message}`,
    );
  }
}

export async function getGoogleAccessToken(
  scope = "https://www.googleapis.com/auth/drive",
): Promise<string> {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope,
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key);
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao autenticar no Google [${res.status}]: ${err}`);
  }
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!json.access_token) {
    throw new Error(`Google não retornou access_token: ${json.error_description || "desconhecido"}`);
  }
  return json.access_token;
}

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

async function getFolderDriveId(accessToken: string, folderId: string): Promise<string | undefined> {
  const res = await fetch(
    `${DRIVE_API}/files/${folderId}?fields=id,driveId&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao acessar pasta do Drive [${res.status}]: ${err}`);
  }
  const json = (await res.json()) as { driveId?: string };
  return json.driveId;
}

async function findFileInFolder(
  accessToken: string,
  folderId: string,
  filename: string,
  driveId?: string,
): Promise<string | undefined> {
  const params = new URLSearchParams({
    q: `name='${filename.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`,
    fields: "files(id,name)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  if (driveId) {
    params.set("corpora", "drive");
    params.set("driveId", driveId);
  }
  const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao buscar arquivo no Drive [${res.status}]: ${err}`);
  }
  const json = (await res.json()) as { files?: { id: string }[] };
  return json.files?.[0]?.id;
}

function buildMultipartBody(
  metadata: Record<string, unknown>,
  fileBuffer: Buffer,
  contentType: string,
): { body: Buffer; boundary: string } {
  const boundary = "----driveUpload" + Date.now().toString(36);
  const enc = (s: string) => Buffer.from(s, "utf8");
  const body = Buffer.concat([
    enc(`--${boundary}\r\n`),
    enc("Content-Type: application/json; charset=UTF-8\r\n\r\n"),
    enc(JSON.stringify(metadata)),
    enc(`\r\n--${boundary}\r\n`),
    enc(`Content-Type: ${contentType}\r\n\r\n`),
    fileBuffer,
    enc(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, boundary };
}

/**
 * Faz upload de um arquivo para uma pasta do Google Drive.
 * Se `upsertByName` for true, substitui o arquivo existente com o mesmo nome (via PATCH).
 */
export async function uploadFileToDrive(opts: {
  folderId: string;
  filename: string;
  data: Buffer;
  contentType: string;
  upsertByName?: boolean;
}): Promise<{ id?: string; name?: string; updated: boolean }> {
  const accessToken = await getGoogleAccessToken();
  const driveId = await getFolderDriveId(accessToken, opts.folderId);

  let existingId: string | undefined;
  if (opts.upsertByName) {
    existingId = await findFileInFolder(accessToken, opts.folderId, opts.filename, driveId);
  }

  const metadata: Record<string, unknown> = existingId
    ? { name: opts.filename, mimeType: opts.contentType }
    : { name: opts.filename, parents: [opts.folderId], mimeType: opts.contentType };

  const { body, boundary } = buildMultipartBody(metadata, opts.data, opts.contentType);

  const url = existingId
    ? `${DRIVE_UPLOAD_API}/files/${existingId}?uploadType=multipart&supportsAllDrives=true`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart&supportsAllDrives=true`;

  const res = await fetch(url, {
    method: existingId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: new Uint8Array(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Drive upload failed [${res.status}]: ${err}`);
    throw new Error(`Falha no upload para Drive [${res.status}]: ${err}`);
  }
  const json = (await res.json()) as { id?: string; name?: string };
  return { id: json.id, name: json.name, updated: !!existingId };
}
