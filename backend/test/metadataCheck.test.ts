import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { hasMetadata, metadataBytes } from "../src/metadataCheck";

const plain = () => sharp({ create: { width: 8, height: 8, channels: 3, background: "#3ddc84" } });

test("a file without metadata is recognised as clean", async () => {
  const buf = await plain().avif().toBuffer();
  assert.equal(hasMetadata(await sharp(buf).metadata()), false);
});

test("EXIF in a JPEG is found", async () => {
  const buf = await plain().jpeg().withExif({ IFD0: { Copyright: "NOXEL" } }).toBuffer();
  const meta = await sharp(buf).metadata();
  assert.equal(hasMetadata(meta), true);
  assert.ok(metadataBytes(meta) > 0);
});

test("text chunks count as metadata", () => {
  assert.equal(hasMetadata({ comments: [{ keyword: "Author", text: "x" }] }), true);
});
