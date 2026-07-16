import { createServerFn } from "@tanstack/react-start";

const DRIVE_FOLDER_ID = "1xflnkggLuDvZWUDbnYZDEfvayiXNdPni";
const AUTO_BACKUP_FILENAME = "backup_demandas.json";

export const uploadBackupToDrive = createServerFn({ method: "POST" })
  .inputValidator((data: { json: string; filename?: string; upsert?: boolean }) => {
    if (!data || typeof data.json !== "string") throw new Error("Invalid input");
    return data;
  })
  .handler(async ({ data }) => {
    const { uploadFileToDrive } = await import("./google-drive.server");
    const upsert = data.upsert ?? false;
    const filename = data.filename || (upsert ? AUTO_BACKUP_FILENAME : `backup_${Date.now()}.json`);
    return uploadFileToDrive({
      folderId: DRIVE_FOLDER_ID,
      filename,
      data: Buffer.from(data.json, "utf8"),
      contentType: "application/json",
      upsertByName: upsert,
    });
  });
