import { createServerFn } from "@tanstack/react-start";

const DRIVE_FOLDER_ID = "16yaWz2Ati8lhL6dkksbvCeOMUF6KO3TE";
const GATEWAY_UPLOAD_URL =
  "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true";

export const uploadExcelToDrive = createServerFn({ method: "POST" })
  .inputValidator((data: { filename: string; base64: string }) => {
    if (!data || typeof data.filename !== "string" || typeof data.base64 !== "string") {
      throw new Error("Invalid input");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!lovableKey || !driveKey) {
      throw new Error("Google Drive não está configurado no servidor.");
    }

    const fileBuffer = Buffer.from(data.base64, "base64");
    const metadata = {
      name: data.filename,
      parents: [DRIVE_FOLDER_ID],
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    const boundary = "----lovableDriveUpload" + Date.now().toString(36);
    const enc = (s: string) => Buffer.from(s, "utf8");
    const body = Buffer.concat([
      enc(`--${boundary}\r\n`),
      enc("Content-Type: application/json; charset=UTF-8\r\n\r\n"),
      enc(JSON.stringify(metadata)),
      enc(`\r\n--${boundary}\r\n`),
      enc(
        "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n",
      ),
      fileBuffer,
      enc(`\r\n--${boundary}--\r\n`),
    ]);

    const res = await fetch(GATEWAY_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": driveKey,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Drive upload failed [${res.status}]: ${err}`);
      throw new Error(`Falha no upload para Drive [${res.status}]: ${err}`);
    }

    const json = (await res.json()) as { id?: string; name?: string };
    return { id: json.id, name: json.name };
  });
