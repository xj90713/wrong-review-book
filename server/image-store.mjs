import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const types = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' };
export function createImageStore(root) {
  return {
    async save(buffer) {
      if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw new Error('图片不能为空或超过 20MB。');
      const extension = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
        : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 ? 'jpg'
        : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' ? 'webp'
        : buffer.toString('ascii', 0, 2) === 'BM' ? 'bmp' : null;
      if (!extension) throw new Error('请上传 PNG、JPEG、WebP 或 BMP 图片。');
      const name = `${createHash('sha256').update(buffer).digest('hex')}.${extension}`;
      await fs.mkdir(root, { recursive: true, mode: 0o700 });
      await fs.writeFile(path.join(root, name), buffer, { mode: 0o600 });
      return { url: `/api/images/${name}` };
    },
    async read(name) {
      if (!/^[a-f0-9]{64}\.(png|jpg|webp|bmp)$/.test(name)) throw new Error('图片地址无效。');
      return { buffer: await fs.readFile(path.join(root, name)), contentType: types[name.split('.').at(-1)] };
    }
  };
}
