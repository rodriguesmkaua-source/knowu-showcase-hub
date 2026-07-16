import { createServerFn } from "@tanstack/react-start";

const DRIVE_FOLDER_ID = "1xflnkggLuDvZWUDbnYZDEfvayiXNdPni";
const BACKUP_FILENAME = "backup_demandas.json";
const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_drive";

export const uploadBackupToDrive = createServerFn({ method: "POST" })
  .inputValidator((data: { json: string }) => {
    if (!data || typeof data.json !== "string") throw new Error("Invalid input");
    return data;
  })
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!lovableKey || !driveKey) {
      throw new Error("Google Drive não está configurado no servidor.");
    }

    const authHeaders = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": driveKey,
    };

    // Search for existing backup file in folder
    const q = encodeURIComponent(
      `name='${BACKUP_FILENAME}' and '${DRIVE_FOLDER_ID}' in parents and trashed=false`,
    );
    const searchRes = await fetch(
      `${GATEWAY_BASE}/drive/v3/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers: authHeaders },
    );
    if (!searchRes.ok) {
      const err = await searchRes.text();
      throw new Error(`Falha ao buscar backup existente [${searchRes.status}]: ${err}`);
    }
    const searchJson = (await searchRes.json()) as { files?: { id: string }[] };
    const existingId = searchJson.files?.[0]?.id;

    const fileBuffer = Buffer.from(data.json, "utf8");
    const boundary = "----lovableBackupUpload" + Date.now().toString(36);
    const enc = (s: string) => Buffer.from(s, "utf8");

    let url: string;
    let method: "POST" | "PATCH";
    let metadata: Record<string, unknown>;
    if (existingId) {
      url = `${GATEWAY_BASE}/upload/drive/v3/files/${existingId}?uploadType=multipart&supportsAllDrives=true`;
      method = "PATCH";
      metadata = { name: BACKUP_FILENAME, mimeType: "application/json" };
    } else {
      url = `${GATEWAY_BASE}/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`;
      method = "POST";
      metadata = {
        name: BACKUP_FILENAME,
        parents: [DRIVE_FOLDER_ID],
        mimeType: "application/json",
      };
    }

    const body = Buffer.concat([
      enc(`--${boundary}\r\n`),
      enc("Content-Type: application/json; charset=UTF-8\r\n\r\n"),
      enc(JSON.stringify(metadata)),
      enc(`\r\n--${boundary}\r\n`),
      enc("Content-Type: application/json\r\n\r\n"),
      fileBuffer,
      enc(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(url, {
      method,
      headers: {
        ...authHeaders,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Drive backup upload failed [${res.status}]: ${err}`);
      throw new Error(`Falha no upload para Drive [${res.status}]: ${err}`);
    }

    const json = (await res.json()) as { id?: string; name?: string };
    return { id: json.id, name: json.name, updated: !!existingId };
  });
