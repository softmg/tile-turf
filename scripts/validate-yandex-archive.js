import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const archivePath = path.resolve(process.cwd(), process.env.YANDEX_ARCHIVE_PATH || "game-yandex.zip");

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= 0; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("game-yandex.zip is not a readable ZIP archive.");
}

function readZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];

  for (let index = 0; index < entryCount; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("game-yandex.zip has a malformed central directory.");
    }

    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    entries.push(name);
    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function validateArchive() {
  const archive = await readFile(archivePath).catch(() => {
    throw new Error("game-yandex.zip is missing. Run npm run package:yandex first.");
  });
  const entries = readZipEntries(archive);

  if (!entries.includes("index.html")) {
    throw new Error("game-yandex.zip has no root index.html entry.");
  }
  const badSeparator = entries.find((entry) => entry.includes("\\"));
  if (badSeparator) {
    throw new Error(`game-yandex.zip contains Windows path separators: ${badSeparator}`);
  }
  if (!entries.some((entry) => entry.startsWith("assets/"))) {
    throw new Error("game-yandex.zip has no assets/ entries.");
  }

  console.log("Yandex archive validation passed.");
}

await validateArchive();
