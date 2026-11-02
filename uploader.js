(() => {
'use strict';
const OWNER = 'mutiwangn';
const REPO = '3d-science-lab';
const API = 'https://api.github.com';
const REPO_API = API + '/repos/' + OWNER + '/' + REPO;
const MAX_HTML = 60 * 1024 * 1024;
const MAX_COVER = 2 * 1024 * 1024;
const CHUNK_BYTES = 3 * 1024 * 1024; // Each GitHub API request stays around 4 MiB.
const NOTION_URL = 'https://app.notion.com/p/9d44ca7a087c497abdd494c99abfc243';
const $ = (id) => document.getElementById(id);
const form = $('upload-form');
const fileInput = $('file');
const coverInput = $('cover');
const button = $('publish');
const localButton = $('local-export');
let busy = false;
let lastRecord = null;

function bytesLabel(count) {
  if (count < 1024 * 1024) return (count / 1024).toFixed(0) + ' KiB';
  return (count / (1024 * 1024)).toFixed(1) + ' MiB';
}
function slugPattern(value) {
  return /^[a-z0-9][a-z0-9-]{1,63}$/.test(value);
}
function freshSlug() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'}).format(now).replace(/[^0-9]/g, '');
  const id = Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, '0')).join('');
  return 'lab-' + (date.length === 8 ? date : now.toISOString().slice(0, 10).replace(/-/g, '')) + '-' + id;
}
function setStage(label, note, percent) {
  $('progress').hidden = false;
  $('stage').textContent = label;
  $('progress-note').textContent = note;
  $('progress-fill').style.width = percent + '%';
}
function feedback(message) {
  $('feedback').textContent = message || '';
}
function fail(message) {
  throw new Error(message);
}
function asBase64(bytes) {
  let parts = [];
  const chunkSize = 32768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize)));
  }
  const output = btoa(parts.join(''));
  parts = [];
  return output;
}
function fromBase64(base64) {
  const raw = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
async function github(token, path, method = 'GET', body = null) {
  let response;
  try {
    response = await fetch(API + path, {
      method,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        ...(body === null ? {} : {'Content-Type': 'application/json'})
      },
      body: body === null ? undefined : JSON.stringify(body),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error'
    });
  } catch (error) {
    fail('浏览器未收到 GitHub API 的 HTTP 响应（网络、代理或浏览器限制；并非已确认令牌无效）。可以稍后重试，或使用下方“GitHub Desktop 本地发布（无需令牌）”。');
  }
  let payload = null;
  try { payload = await response.json(); } catch (error) { /* Errors may be empty. */ }
  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : '请求失败';
    const operation = method + ' ' + path.split('?')[0];
    // GitHub returns this header on permission failures when CORS exposes it.
    const requiredPermissions = response.headers.get('X-Accepted-GitHub-Permissions');
    const isTokenPermissionError = response.status === 403
      && /resource not accessible by personal access token/i.test(message);
    const advice = response.status === 401 ? '授权令牌无效或已过期。'
      : isTokenPermissionError
        ? '细粒度令牌权限不足：检查 Resource owner=mutiwangn、Selected repositories=3d-science-lab、Contents=Read and write。'
      : response.status === 403 ? '访问被拒绝：请检查令牌授权、仓库权限或 GitHub 速率限制。'
      : response.status === 404 ? '找不到仓库或令牌无权访问。'
      : response.status === 422 && /input was too large/i.test(message) ? 'GitHub 拒绝处理该分片，请记录失败的分片序号并联系维护者。'
      : response.status === 409 || response.status === 422 ? '仓库可能在其他设备上刚被修改，请刷新页面并重试。'
      : '请稍后重试。';
    const permissionHint = requiredPermissions ? ' 接口要求权限：' + requiredPermissions + '。' : '';
    fail('GitHub API ' + response.status + '（' + operation + '）：' +
      message.slice(0, 170) + '。' + permissionHint + ' ' + advice);
  }
  return payload;
}
async function verifyOwner(token) {
  const identity = await github(token, '/user');
  if (String(identity?.login).toLowerCase() !== OWNER.toLowerCase()) {
    fail('当前令牌属于 ' + (identity?.login || '未知用户') + '，此页面仅允许仓库所有者 ' + OWNER + ' 发布。');
  }
}
function makeRandomPassword() {
  // 24 random bytes = 192 bits. No modulo-bias from character picking.
  const pwd = asBase64(crypto.getRandomValues(new Uint8Array(24)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  $('work-password').value = pwd;
  $('show-password').checked = true;
  $('work-password').type = 'text';
  $('work-password').focus();
}
function prepareFile(file) {
  feedback('');
  $('success').hidden = true;
  lastRecord = null;
  if (!file) {
    $('drop-title').textContent = '点击或拖入单体 HTML 文件';
    $('file-hint').textContent = '支持 1–60 MiB · 3D 模型、纹理和脚本需已打包进 HTML';
    return;
  }
  $('drop-title').textContent = file.name;
  $('file-hint').textContent = bytesLabel(file.size) + ' · ' + (file.size > MAX_HTML ? '文件超过 60 MiB 限制' : '准备就绪');
  if (!file.name.toLowerCase().match(/\.html?$/)) feedback('请选择 .html 或 .htm 单体网页文件。');
  if (file.size > MAX_HTML) feedback('文件超过 60 MiB。请缩小模型和纹理，或以后改用对象存储。');
  if (!$('title').value.trim()) $('title').value = file.name.replace(/\.html?$/i, '').slice(0, 70);
}
function validate(info, file, cover, requireToken = true) {
  if (!file) fail('请先选择作品 HTML 文件。');
  if (!/\.html?$/i.test(file.name)) fail('只支持单体 HTML 文件，不支持 ZIP 或 GLB 直接上传。');
  if (!file.size || file.size > MAX_HTML) fail('HTML 文件必须大于 0 且不超过 60 MiB。');
  if (!info.title || info.title.length > 70) fail('请填写作品名称（不超过 70 字）。');
  if (!slugPattern(info.id)) fail('作品编号须为 2–64 位小写字母、数字和连字符。');
  if (!['3D教师演示', '3D学生操作', '数字工具'].includes(info.type)) fail('请选择有效的作品类别。');
  if (info.password.length < 12) fail('作品解锁密码至少 12 个字符，建议使用随机生成。');
  if (requireToken && !info.token) fail('在线直传需要 GitHub 细粒度授权令牌；也可以选择无需令牌的本地发布。');
  if (cover) {
    if (!/\.(png|jpe?g|webp)$/i.test(cover.name) || !['image/png','image/jpeg','image/webp'].includes(cover.type)) fail('封面只能是 PNG / JPG / WebP 图片。');
    if (!cover.size || cover.size > MAX_COVER) fail('封面不得超过 2 MiB。');
  }
}
function inspectHtml(html) {
  if (!/<!doctype\s+html|<html[\s>]/i.test(html.slice(0, 250000))) fail('文件不像完整的 HTML 网页。请选用已经制作完成的单体 HTML。');
  // Local file references would resolve outside the encrypted HTML when displayed.
  const localRef = /\b(?:src|href)\s*=\s*(['"])(?!data:|https?:\/\/|\/\/|#|blob:|about:|mailto:)([^'"]+)\1/gi;
  const match = localRef.exec(html);
  if (match) fail('检测到外部本地文件引用：' + match[2].slice(0, 100) + '。请将 GLB、图片、JS 等资源内嵌到单体 HTML 后再上传。');
  const dynamicLocal = /(?:fetch|load|setPath)\s*\(\s*(['"])(?!data:|https?:\/\/|\/\/|blob:|#)([^'"]+\.(?:glb|gltf|bin|png|jpe?g|webp|mp3|wav|json|js|css)(?:\?[^'"]*)?)\1/gi;
  const dynamicMatch = dynamicLocal.exec(html);
  if (dynamicMatch) fail('检测到脚本读取本地资源：' + dynamicMatch[2].slice(0, 100) + '。请先打包为单体 HTML。');
  // Network-loaded original models or textures would be public even if the HTML is encrypted.
  if (/\b(?:src|href)\s*=\s*['"]https?:\/\//i.test(html)) {
    // This is allowed for public libraries/CDNs; the owner must ensure any private asset is embedded.
    $('file-hint').textContent = bytesLabel(fileInput.files[0].size) + ' · 含联网资源，请确认原创模型未放在公开链接';
  }
}
async function encryptHtml(html, password, id) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'}, material, {name:'AES-GCM',length:256}, false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,tagLength:128}, key, new TextEncoder().encode(html)));
  const common = {
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 310000,
    salt: asBase64(salt),
    iv: asBase64(iv)
  };
  if (cipher.length <= CHUNK_BYTES) {
    return {manifest: JSON.stringify({version:1,...common,data:asBase64(cipher)}) + '\n', chunks:[]};
  }
  // Keep ciphertext encrypted as one authenticated AES-GCM message, only split its Base64 transport.
  const parts = [];
  const chunks = [];
  for (let offset = 0, part = 1; offset < cipher.length; offset += CHUNK_BYTES, part++) {
    const path = 'encrypted/' + id + '/part-' + String(part).padStart(3, '0') + '.b64';
    parts.push('./' + path);
    chunks.push({path, content:asBase64(cipher.subarray(offset, offset + CHUNK_BYTES)) + '\n'});
  }
  const manifest = JSON.stringify({version:2,...common,byteLength:cipher.length,parts}, null, 2) + '\n';
  return {manifest, chunks};
}
async function createBlob(token, content, encoding = 'utf-8') {
  const result = await github(token, '/repos/' + OWNER + '/' + REPO + '/git/blobs', 'POST', {content, encoding});
  if (!/^[a-f0-9]{40}$/.test(result?.sha || '')) fail('GitHub 未返回有效的文件标识。');
  return result.sha;
}
function decodeCatalog(result) {
  if (result?.encoding !== 'base64' || typeof result?.content !== 'string') fail('无法读取作品目录内容。');
  let items;
  try { items = JSON.parse(new TextDecoder().decode(fromBase64(result.content))); }
  catch (error) { fail('GitHub 中的 catalog.json 格式错误。'); }
  if (!Array.isArray(items)) fail('作品目录必须是数组。');
  return items;
}
function localDate() {
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function collectInfo() {
  return {
    title: $('title').value.trim(),
    id: $('slug').value.trim(),
    grade: $('grade').value.trim() || '科学探究',
    type: $('type').value,
    version: $('version').value.trim() || 'v1.0',
    description: $('description').value.trim() || '进入三维科学互动实验。',
    token: $('token').value.trim(),
    password: $('work-password').value,
    replace: $('replace').checked
  };
}
async function publish(event) {
  event.preventDefault();
  if (busy) return;
  const file = fileInput.files?.[0], cover = coverInput.files?.[0] || null;
  const info = collectInfo();
  try { validate(info, file, cover); } catch(error) { feedback(error.message); return; }
  if (!window.isSecureContext || !crypto?.subtle) { feedback('请通过 HTTPS 打开页面，并使用支持 Web Crypto 的现代浏览器。'); return; }
  busy = true;
  button.disabled = true;
  localButton.disabled = true;
  button.textContent = '正在安全发布…';
  $('success').hidden = true;
  feedback('');
  lastRecord = null;
  try {
    setStage('1 / 5 · 检查 GitHub 授权', '验证账户与仓库权限', 10);
    await verifyOwner(info.token);
    const catalogObject = await github(info.token,'/repos/' + OWNER + '/' + REPO + '/contents/catalog.json?ref=main');
    const catalog = decodeCatalog(catalogObject);
    const existingIndex = catalog.findIndex(item => item && item.id === info.id);
    if (existingIndex !== -1 && !info.replace) fail('作品编号已存在。请修改编号，或者勾选“更新已有作品”。');
    if (existingIndex === -1 && info.replace) fail('找不到需要更新的作品。请取消“更新已有作品”选项。');
    setStage('2 / 5 · 在本机加密 HTML', '原始 HTML 不会进入 GitHub；大文件加密需要一点时间', 28);
    const html = await file.text();
    inspectHtml(html);
    const encrypted = await encryptHtml(html, info.password, info.id);
    if (new Blob([encrypted.manifest]).size > 8 * 1024 * 1024) fail('作品清单异常，请重新选择文件。');
    const treeEntries = [];
    for (let i = 0; i < encrypted.chunks.length; i++) {
      const part = encrypted.chunks[i];
      const current = i + 1, total = encrypted.chunks.length;
      setStage('3 / 5 · 上传加密分片 ' + current + ' / ' + total,
        '每次上传约 4 MiB 密文；可持续数分钟，请保持页面打开',
        45 + Math.round(19 * current / total));
      const sha = await createBlob(info.token, part.content);
      treeEntries.push({path:part.path,mode:'100644',type:'blob',sha});
    }
    setStage('3 / 5 · 提交加密清单', '密文已分块上传，准备更新作品目录', 66);
    const manifestSha = await createBlob(info.token, encrypted.manifest);
    treeEntries.push({path:'encrypted/' + info.id + '.json',mode:'100644',type:'blob',sha:manifestSha});
    let coverPath = existingIndex >= 0 ? catalog[existingIndex].cover : './covers/demo-cube.svg';
    if (cover) {
      setStage('3 / 5 · 上传公开封面', '仅封面会公开显示；请不要包含敏感信息', 69);
      const suffix = cover.name.split('.').pop().toLowerCase().replace('jpeg','jpg');
      coverPath = './covers/' + info.id + '.' + suffix;
      const bytes = new Uint8Array(await cover.arrayBuffer());
      const sha = await createBlob(info.token, asBase64(bytes), 'base64');
      treeEntries.push({path:'covers/' + info.id + '.' + suffix,mode:'100644',type:'blob',sha});
    }
    const work = {
      id:info.id,
      title:info.title,
      grade:info.grade,
      description:info.description,
      type:info.type,
      cover:coverPath,
      file:'./encrypted/' + info.id + '.json'
    };
    if (existingIndex !== -1) catalog[existingIndex] = work;
    else catalog.push(work);
    setStage('4 / 5 · 更新作品目录', '将加密文件和公开目录合并为同一 GitHub 提交', 75);
    const catalogSha = await createBlob(info.token, JSON.stringify(catalog,null,2) + '\n');
    treeEntries.push({path:'catalog.json',mode:'100644',type:'blob',sha:catalogSha});
    const ref = await github(info.token,'/repos/' + OWNER + '/' + REPO + '/git/ref/heads/main');
    const headSha = ref?.object?.sha;
    if (!/^[a-f0-9]{40}$/.test(headSha || '')) fail('无法确定 main 分支当前版本。');
    const current = await github(info.token,'/repos/' + OWNER + '/' + REPO + '/git/commits/' + headSha);
    const treeSha = current?.tree?.sha;
    if (!/^[a-f0-9]{40}$/.test(treeSha || '')) fail('无法读取 main 分支的目录结构。');
    const tree = await github(info.token,'/repos/' + OWNER + '/' + REPO + '/git/trees','POST',{base_tree:treeSha,tree:treeEntries});
    const message = (info.replace ? 'Update' : 'Publish') + ' encrypted 3D work: ' + info.id;
    const commit = await github(info.token,'/repos/' + OWNER + '/' + REPO + '/git/commits','POST',{message,tree:tree.sha,parents:[headSha]});
    setStage('5 / 5 · 正式发布', '更新 main 分支，随后由 GitHub Pages 自动部署', 88);
    await github(info.token,'/repos/' + OWNER + '/' + REPO + '/git/refs/heads/main','PATCH',{sha:commit.sha,force:false});
    setStage('已发布成功', '加密文件与作品目录已提交。网页可能需要数分钟更新。', 100);
    $('success').hidden = false;
    $('success-title').textContent = '✓ 已提交到 GitHub';
    $('success-note').textContent = 'Pages 部署通常需要稍等片刻。请进入展厅，用新密码验证作品。';
    $('commit-link').hidden = false;
    $('local-steps').hidden = true;
    $('commit-link').href = 'https://github.com/' + OWNER + '/' + REPO + '/commit/' + commit.sha;
    lastRecord = {title:info.title,id:info.id,grade:info.grade,type:info.type,version:info.version,password:info.password,date:localDate(),size:bytesLabel(file.size),status:'已提交 GitHub，待 Pages 部署'};
    $('success').scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch(error) {
    feedback(error?.message || '发布未完成，请检查文件与网络后重试。');
    setStage('发布未完成', '请检查提示。已上传但未提交的密文不会出现在作品展厅。', 0);
  } finally {
    busy = false;
    button.disabled = false;
    localButton.disabled = false;
    button.textContent = '通过 GitHub API 在线发布 ↗';
  }
}

async function readLocalRepository(directory) {
  // Never write to an arbitrary selected folder. Check the cloned repository identity.
  if (directory.name !== REPO) fail('请选择 GitHub Desktop 克隆的“' + REPO + '”文件夹，当前选择的是“' + directory.name + '”。');
  let readme, index, catalog;
  try {
    readme = await (await directory.getFileHandle('README.md')).getFile();
    index = await (await directory.getFileHandle('index.html')).getFile();
    catalog = await (await directory.getFileHandle('catalog.json')).getFile();
  } catch (error) {
    fail('所选文件夹缺少 README.md、index.html 或 catalog.json。请先在 GitHub Desktop 中克隆 3d-science-lab，并选择仓库根目录。');
  }
  const [readmeText, indexText, catalogText] = await Promise.all([
    readme.text(), index.text(), catalog.text()
  ]);
  if (!readmeText.includes('MUTIW · 3D 科学互动实验室') || !indexText.includes('data.version!==2')) {
    fail('这不是已更新的 3d-science-lab 仓库，或本地版本太旧。请在 GitHub Desktop 中先 Fetch origin / Pull，再重试。');
  }
  let items;
  try { items = JSON.parse(catalogText); } catch (error) { fail('本地 catalog.json 不是有效 JSON。请先修复或重新拉取仓库。'); }
  if (!Array.isArray(items)) fail('本地 catalog.json 必须是作品数组。');
  return items;
}
async function writeLocalFile(directory, path, data) {
  // Paths are built from a validated slug; this additionally guards every filesystem write.
  if (!/^(?:catalog\.json|encrypted\/[a-z0-9-]+\.json|encrypted\/[a-z0-9-]+\/part-\d{3}\.b64|covers\/[a-z0-9-]+\.(?:png|jpg|webp))$/.test(path)) {
    fail('发布文件路径无效：' + path);
  }
  const pieces = path.split('/');
  let folder = directory;
  for (let i = 0; i < pieces.length - 1; i++) {
    folder = await folder.getDirectoryHandle(pieces[i], {create:true});
  }
  const handle = await folder.getFileHandle(pieces[pieces.length - 1], {create:true});
  const writer = await handle.createWritable();
  try {
    await writer.write(data);
    await writer.close();
  } catch (error) {
    try { await writer.abort(); } catch (_) { /* Best effort. */ }
    throw error;
  }
}
async function exportLocal() {
  if (busy) return;
  const file = fileInput.files?.[0], cover = coverInput.files?.[0] || null;
  const info = collectInfo();
  try { validate(info, file, cover, false); } catch (error) { feedback(error.message); return; }
  if (!window.isSecureContext || !crypto?.subtle) {
    feedback('请使用 HTTPS 入口，并在支持本机文件夹授权的 Chrome / Edge 电脑浏览器中操作。');
    return;
  }
  if (typeof window.showDirectoryPicker !== 'function') {
    feedback('当前浏览器不支持安全选择文件夹。请在电脑的最新版 Chrome 或 Edge 中打开本站，或使用仓库内 tools/encrypt-work.mjs。');
    return;
  }
  // Browser security requires that the directory picker open directly from the user's click.
  let directory;
  try {
    directory = await window.showDirectoryPicker({mode:'readwrite'});
  } catch (error) {
    if (error?.name === 'AbortError') { feedback('已取消选择文件夹，没有生成或上传任何作品文件。'); return; }
    feedback('无法访问文件夹。请授权 Chrome / Edge 读写克隆仓库的目录，再重试。'); return;
  }
  busy = true;
  button.disabled = true;
  localButton.disabled = true;
  localButton.textContent = '正在本机加密…';
  $('success').hidden = true;
  lastRecord = null;
  feedback('');
  try {
    setStage('1 / 5 · 检查本地仓库', '请确保已在 GitHub Desktop 先 Fetch origin / Pull', 10);
    const catalog = await readLocalRepository(directory);
    const existingIndex = catalog.findIndex(item => item && item.id === info.id);
    if (existingIndex !== -1 && !info.replace) fail('这个作品编号已存在。更新时请勾选“更新已有作品”。');
    if (existingIndex === -1 && info.replace) fail('本地仓库没有对应编号的作品，不能更新。');
    setStage('2 / 5 · 在电脑中加密', '仅在此浏览器处理原始 HTML；不会发送到 GitHub API', 28);
    const html = await file.text();
    inspectHtml(html);
    const encrypted = await encryptHtml(html, info.password, info.id);
    setStage('3 / 5 · 写入加密分片', '文件将写入你选定的本地 3d-science-lab 文件夹', 45);
    for (let i = 0; i < encrypted.chunks.length; i++) {
      const part = encrypted.chunks[i];
      await writeLocalFile(directory, part.path, part.content);
      const count = i + 1;
      setStage('3 / 5 · 写入加密分片 ' + count + ' / ' + encrypted.chunks.length,
        '仅写入本机，不会使用令牌或联网提交', 45 + Math.round(20 * count / encrypted.chunks.length));
    }
    await writeLocalFile(directory, 'encrypted/' + info.id + '.json', encrypted.manifest);
    let coverPath = existingIndex >= 0 ? catalog[existingIndex].cover : './covers/demo-cube.svg';
    if (cover) {
      setStage('4 / 5 · 写入公开封面', '封面不加密，请勿包含私人信息', 72);
      const suffix = cover.name.split('.').pop().toLowerCase().replace('jpeg','jpg');
      coverPath = './covers/' + info.id + '.' + suffix;
      await writeLocalFile(directory, 'covers/' + info.id + '.' + suffix, cover);
    }
    const work = {
      id: info.id, title: info.title, grade: info.grade, description: info.description,
      type: info.type, cover: coverPath, file: './encrypted/' + info.id + '.json'
    };
    if (existingIndex !== -1) catalog[existingIndex] = work;
    else catalog.push(work);
    setStage('5 / 5 · 更新本地作品目录', '先写密文，最后更新目录；下一步需你在 GitHub Desktop 手动推送', 88);
    await writeLocalFile(directory, 'catalog.json', JSON.stringify(catalog, null, 2) + '\n');
    setStage('本机准备完成 · 尚未发布', '请在 GitHub Desktop 中 Commit to main → Push origin，再到主页验证解锁', 100);
    $('success-title').textContent = '✓ 已在本机准备好加密发布文件';
    $('success-note').textContent = '尚未上传到 GitHub。请按下方步骤通过 GitHub Desktop 提交并推送。关闭页面前，务必复制密码登记信息到私人 Notion。';
    $('commit-link').hidden = true;
    $('local-steps').hidden = false;
    $('success').hidden = false;
    lastRecord = {
      title:info.title, id:info.id, grade:info.grade, type:info.type,
      version:info.version, password:info.password, date:localDate(),
      size:bytesLabel(file.size), status:'本机已准备，待 GitHub Desktop 推送'
    };
    $('success').scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch (error) {
    feedback('本地发布未完成：' + (error?.message || '文件夹读写失败。') +
      ' 请不要在 GitHub Desktop 中提交不完整的更改；排查后可使用同样的作品编号重新生成。');
    setStage('本地生成未完成', '没有向 GitHub 提交文件；请检查本地目录与浏览器权限', 0);
  } finally {
    busy = false;
    button.disabled = false;
    localButton.disabled = false;
    localButton.textContent = '在本机生成发布文件（无需令牌） ↘';
  }
}

async function copyRecord() {
  if (!lastRecord) return;
  const item = lastRecord;
  const value = [
    '作品名称：' + item.title,
    '作品编号：' + item.id,
    '分类：' + item.type,
    '适用课时：' + item.grade,
    '版本号：' + item.version,
    '当前解锁密码：' + item.password,
    '密码更新日期：' + item.date,
    '发布日期：' + item.date,
    '发布状态：' + item.status,
    '访问范围：授权访问',
    '网页入口：https://' + OWNER + '.github.io/' + REPO + '/',
    '加密文件路径：encrypted/' + item.id + '.json',
    '原始文件大小：' + item.size,
    '请在私人 Notion 台账登记，不要粘贴到公开仓库。'
  ].join('\n');
  try {
    await navigator.clipboard.writeText(value);
    $('copy-record').textContent = '✓ 已复制，请到 Notion 粘贴';
  } catch(error) {
    feedback('复制失败。请在浏览器中允许剪贴板权限，或手动登记密码。');
  }
}
if (!$('slug').value) $('slug').value = freshSlug();
fileInput.addEventListener('change', () => prepareFile(fileInput.files?.[0]));
const dropzone = $('dropzone');
['dragenter','dragover'].forEach(eventName => dropzone.addEventListener(eventName, event => {
  event.preventDefault();
  if (!busy) dropzone.classList.add('dragover');
}));
['dragleave','drop'].forEach(eventName => dropzone.addEventListener(eventName, event => {
  event.preventDefault();
  dropzone.classList.remove('dragover');
  if (eventName === 'drop' && !busy && event.dataTransfer?.files?.length) {
    fileInput.files = event.dataTransfer.files;
    prepareFile(fileInput.files?.[0]);
  }
}));
$('generate').addEventListener('click', makeRandomPassword);
$('show-password').addEventListener('change', event => {
  $('work-password').type = event.target.checked ? 'text' : 'password';
});
$('copy-record').addEventListener('click', copyRecord);
form.addEventListener('submit', publish);
localButton.addEventListener('click', exportLocal);
})();