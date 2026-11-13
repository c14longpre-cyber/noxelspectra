// What "Clean metadata" (POST /api/strip-metadata) looks for in a file, from sharp's metadata().
// EXIF (camera, GPS, date), ICC colour profile, IPTC, XMP, and the text chunks / comments
// that PNG and GIF files can carry. When none is present the file is returned untouched.
type MetaLike = {
  exif?: Buffer; icc?: Buffer; iptc?: Buffer; xmp?: Buffer;
  comments?: { keyword: string; text: string }[];
};

export function metadataBytes(meta: MetaLike): number {
  return (meta.exif?.length ?? 0) + (meta.icc?.length ?? 0) + (meta.iptc?.length ?? 0) + (meta.xmp?.length ?? 0)
    + (meta.comments ?? []).reduce((n, c) => n + (c.keyword?.length ?? 0) + (c.text?.length ?? 0), 0);
}

export function hasMetadata(meta: MetaLike): boolean {
  return metadataBytes(meta) > 0;
}
