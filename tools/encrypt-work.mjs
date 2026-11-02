#!/usr/bin/env node
/**
 * MUTIW 3D Lab - encrypt one self-contained HTML work for GitHub Pages.
 * The password is only read from a hidden terminal prompt or a transient env var.
 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { dirname, resolve, relative, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const sourceFile = args[0];
const slug = args[1];

function option(name, fallback = '') {
  const i = args.indexOf('--' + name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
}
function fail(message) {
  console.error('\n错误：' + message);
  process.exit(1);
}
if (!sourceFile || !slug || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(slug)) {
  fail('用法：node tools/encrypt-work.mjs <源HTML路径> <英文作品ID> --title "作品名" --grade "年级" --cover "./covers/封面.svg" [--replace]');
}
if (!/\.html?$/i.test(sourceFile)) fail('输入文件必须为单体 HTML。');
const absolute = resolve(sourceFile);
const localPath = relative(root, absolute);
const isWithinRoot = localPath === '' || (!localPath.startsWith('..') && !isAbsolute(localPath));
if (isWithinRoot && !args.includes('--demo')) {
  fail('源 HTML 位于公开仓库目录内！请把原创明文文件放在仓库外，再运行加密工具。');
}
const info = await stat(absolute).catch(() => fail('找不到源文件：' + absolute));
if (info.size > 50 * 1024 * 1024) fail('单个 HTML 不应超过 50 MB；请先优化模型与资源。');
const html = await readFile(absolute, 'utf8');
if (!/<html[\s>]/i.test(html)) fail('文件看起来不是完整的 HTML 文档。');
if (/(?:src|href)\s*=\s*["'](?!data:|https?:|#|\/\/)[^"']+["']/i.test(html)
  || /(?:fetch|load|setPath)\s*\(\s*["'](?!data:|https?:|\/\/)[^"']+\.(?:glb|gltf|png|jpg|jpeg|webp|mp3|wav|json|bin)/i.test(html)) {
  fail('发现可能的本地外部资源引用。请先将 3D 模型、纹理等打包进单体 HTML，防止明文文件暴露。');
}
const catalogPath = join(root, 'catalog.json');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
if (!Array.isArray(catalog)) fail('catalog.json 格式错误。');
const previousIndex = catalog.findIndex(w => w.id === slug);
if (previousIndex >= 0 && !args.includes('--replace')) fail('作品 ID 已存在。更新作品请增加 --replace。');

async function hidden(label) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    fail('无法在非交互终端中安全输入口令。请在本地终端运行，或临时设置环境变量 SCIENCE_LAB_PASSWORD。');
  }
  process.stdout.write(label);
  return await new Promise((resolvePromise, rejectPromise) => {
    const stdin = process.stdin;
    const oldRaw = stdin.isRaw;
    let value = '';
    stdin.setRawMode(true);
    stdin.resume();
    function finish(error) {
      stdin.off('data', onData);
      stdin.setRawMode(Boolean(oldRaw));
      stdin.pause();
      process.stdout.write('\n');
      if (error) rejectPromise(error);
      else resolvePromise(value);
    }
    function onData(buffer) {
      for (const char of buffer.toString('utf8')) {
        if (char === '\r' || char === '\n') { finish(); return; }
        if (char === '\u0003') { finish(new Error('已取消')); return; }
        if (char === '\u007f' || char === '\b') { value = value.slice(0, -1); continue; }
        if (char >= ' ' && char !== '\u007f') value += char;
      }
    }
    stdin.on('data', onData);
  });
}
let password = process.env.SCIENCE_LAB_PASSWORD;
if (!password) {
  try {
    password = await hidden('请输入作品口令（不回显）：');
    const confirmation = await hidden('请再次输入口令：');
    if (password !== confirmation) fail('两次输入的口令不一致。');
  } catch (error) {
    fail(error.message);
  }
}
if ([...password].length < 12) fail('口令至少 12 个字符，建议使用 16 位以上随机口令。');

const salt = randomBytes(16);
const iv = randomBytes(12);
const key = pbkdf2Sync(password, salt, 310000, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const content = Buffer.concat([cipher.update(html, 'utf8'), cipher.final(), cipher.getAuthTag()]);
key.fill(0);
password = '';

const envelope = {
  version: 1,
  algorithm: 'AES-256-GCM',
  kdf: 'PBKDF2-SHA256',
  iterations: 310000,
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  data: content.toString('base64')
};
const output = join(root, 'encrypted', slug + '.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(envelope) + '\n', 'utf8');

const previous = previousIndex < 0 ? null : catalog[previousIndex];
const work = {
  id: slug,
  title: option('title', previous?.title || slug),
  grade: option('grade', previous?.grade || '科学探究'),
  description: option('description', previous?.description || '进入三维科学互动实验。'),
  type: option('type', previous?.type || '3D 互动'),
  cover: option('cover', previous?.cover || './covers/demo-cube.svg'),
  file: './encrypted/' + slug + '.json'
};
if (args.includes('--demo')) work.demo = true;
if (previousIndex >= 0) catalog[previousIndex] = work;
else catalog.push(work);
await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log('\n已加密：' + output);
console.log('已更新目录：' + catalogPath);
console.log('请只提交加密 JSON、公开封面和目录，不要将明文 HTML 上传到公开仓库。');
