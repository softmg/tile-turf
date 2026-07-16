import { deflateRawSync } from "node:zlib";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const buildDir = path.resolve(root, process.env.YANDEX_BUILD_DIR || "dist-yandex");
const archivePath = path.resolve(root, process.env.YANDEX_ARCHIVE_PATH || "game-yandex.zip");

const crcTable = new Uint32Array(256);
for (let i = 0; i < crcTable.length; i++) {
  let value = i;
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[i] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolute)));
    } else if (entry.isFile()) {
      files.push({
        absolute,
        relative: path.relative(buildDir, absolute).split(path.sep).join("/"),
      });
    }
  }

  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

async function createArchive() {
  await stat(path.join(buildDir, "index.html")).catch(() => {
    throw new Error(`${path.relative(root, buildDir)}/index.html is missing. Run npm run build:yandex first.`);
  });

  const files = await collectFiles(buildDir);
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.relative, "utf8");
    const content = await readFile(file.absolute);
    const compressed = deflateRawSync(content);
    const checksum = crc32(content);

    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(checksum),
      u32(compressed.length),
      u32(content.length),
      u16(name.length),
      u16(0),
      name,
    ]);

    const centralHeader = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(8),
      u16(0),
      u16(0),
      u32(checksum),
      u32(compressed.length),
      u32(content.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);

    chunks.push(localHeader, compressed);
    central.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralOffset = offset;
  const centralDirectory = Buffer.concat(central);
  const endOfCentralDirectory = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDirectory.length),
    u32(centralOffset),
    u16(0),
  ]);

  await unlink(archivePath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  await mkdir(path.dirname(archivePath), { recursive: true });
  await writeFile(archivePath, Buffer.concat([...chunks, centralDirectory, endOfCentralDirectory]));
  console.log(`Created ${archivePath}`);
}

await createArchive();
