import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DRIVE_FOLDER_ID = "1xflnkggLuDvZWUDbnYZDEfvayiXNdPni";
const AUTO_BACKUP_FILENAME = "backup_demandas.json";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

export const uploadBackupToDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { json: string; filename?: string; upsert?: boolean }) => {
    if (!data || typeof data.json !== "string") throw new Error("Invalid input");
    return data;
  })
  .handler(async ({ data }) => {
    const payload = Buffer.from(data.json, "utf8");
    if (payload.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("Backup excede o tamanho máximo de 20 MB");
    }
    const { uploadFileToDrive } = await import("./google-drive.server");
    const upsert = data.upsert ?? false;
    const filename = data.filename || (upsert ? AUTO_BACKUP_FILENAME : `backup_${Date.now()}.json`);
    return uploadFileToDrive({
      folderId: DRIVE_FOLDER_ID,
      filename,
      data: payload,
      contentType: "application/json",
      upsertByName: upsert,
    });
  });
