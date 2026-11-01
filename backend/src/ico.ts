// Fichier .ico à partir d'images PNG (format « PNG dans ICO », accepté par tous les navigateurs
// et par Windows depuis Vista). Remplace le paquet to-ico, abandonné et plein de failles connues.
export function pngsToIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);             // réservé
  header.writeUInt16LE(1, 2);             // type : icône
  header.writeUInt16LE(images.length, 4); // nombre d'images
  const entries: Buffer[] = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // largeur (0 = 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // hauteur
    e.writeUInt8(0, 2);                      // pas de palette
    e.writeUInt8(0, 3);                      // réservé
    e.writeUInt16LE(1, 4);                   // plans de couleur
    e.writeUInt16LE(32, 6);                  // bits par pixel
    e.writeUInt32LE(png.length, 8);          // taille des données
    e.writeUInt32LE(offset, 12);             // position des données
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}
