/**
 * TEST seed only: sample signature PNGs for the test and sample users, written
 * to estimator-files/signatures/<auth uid>.png. No network in this module;
 * seed-test.mjs does the upload with the service key it already uses.
 */
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

export const SIGNATURE_BUCKET = "estimator-files";
export const SIGNATURE_WIDTH = 240;
export const SIGNATURE_HEIGHT = 64;

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n += 1) {
		let c = n;
		for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}

/** A fixed scribble per name: same name, same bytes. Dark blue ink on a transparent background. */
export function signaturePng(name) {
	const w = SIGNATURE_WIDTH;
	const h = SIGNATURE_HEIGHT;
	const seed = createHash("sha1").update(String(name || "signature")).digest();
	const pixels = Buffer.alloc(w * h * 4);
	const dot = (x, y) => {
		for (let dy = -1; dy <= 1; dy += 1) {
			for (let dx = -1; dx <= 1; dx += 1) {
				const px = Math.round(x) + dx;
				const py = Math.round(y) + dy;
				if (px < 0 || py < 0 || px >= w || py >= h) continue;
				const i = (py * w + px) * 4;
				pixels[i] = 22;
				pixels[i + 1] = 34;
				pixels[i + 2] = 72;
				pixels[i + 3] = 255;
			}
		}
	};
	const loops = 3 + (seed[0] % 3);
	for (let x = 12; x < w - 12; x += 0.5) {
		const t = (x - 12) / (w - 24);
		const amp = 10 + (seed[1] % 10);
		const y = h / 2 + Math.sin(t * Math.PI * 2 * loops + seed[2] / 40) * amp * (1 - t * 0.5) + Math.sin(t * 17 + seed[3]) * 3;
		dot(x, y);
	}
	for (let x = w * 0.2; x < w * 0.85; x += 0.5) dot(x, h - 12 + Math.sin(x / 9) * 1.5);
	const raw = Buffer.alloc((w * 4 + 1) * h);
	for (let y = 0; y < h; y += 1) {
		raw[y * (w * 4 + 1)] = 0;
		pixels.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
	}
	const header = Buffer.alloc(13);
	header.writeUInt32BE(w, 0);
	header.writeUInt32BE(h, 4);
	header[8] = 8;
	header[9] = 6;
	header[10] = 0;
	header[11] = 0;
	header[12] = 0;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/**
 * One upload per auth uid. `userKey` (test users) or `uidFor(id)` (sample
 * users) gives the same UUID the JWT carries, so the app finds the file.
 */
export function signatureTargets(people, uidFor) {
	const out = [];
	const seen = new Set();
	for (const person of people || []) {
		if (!person) continue;
		const key = String(person.userKey || (person.userId ? uidFor(person.userId) : "") || (person.id ? uidFor(person.id) : "")).trim();
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push({ name: String(person.name || ""), userKey: key, path: `signatures/${key}.png` });
	}
	return out;
}
