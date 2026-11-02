(() => {
'use strict';
const OWNER = 'mutiwangn';
const REPO = '3d-science-lab';
const API = 'https://api.github.com';
const REPO_API = API + '/repos/' + OWNER + '/' + REPO;
const MAX_HTML = 60 * 1024 * 1024;
const MAX_COVER = 2 * 1024 * 1024;
const NOTION_URL = 'https://app.notion.com/p/9d44ca7a087c497abdd494c99abfc243';
const $ = (id) => document.getElementById(id);
const form = $('upload-form');
const fileInput = $('file');
const coverInput = $('cover');
const button = $('publish');
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
    fail('无法连接 GitHub API。请检查网络、代理设置，或稍后重试。');
  }
  let payload = null;
  try { payload = await response.json(); } catch (error) { /* Errors may be empty. */ }
  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : '请求失败';
    const advice = response.status === 401 ? '授权令牌无效或已过期。'
      : response.status === 403 ? '没有写入权限、被限流，或令牌未授权此仓库。'
      : response.status === 404 ? '找不到仓库或令牌无权访问。'
      : response.status === 409 || response.status === 422 ? '仓库可能在其他设备上刚被修改，请刷新页面并重试。'
      : '请稍后重试。';
    fail('GitHub API ' + response.status + '：' + message.slice(0, 170) + '。' + advice);
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
function validate(info, file, cover) {
  if (!file) fail('请先选择作品 HTML 文件。');
  if (!/\.html?$/i.test(file.name)) fail('只支持单体 HTML 文件，不支持 ZIP 或 GLB 直接上传。');
  if (!file.size || file.size > MAX_HTML) fail('HTML 文件必须大于 0 且不超过 60 MiB。');
  if (!info.title || info.title.length > 70) fail('请填写作品名称（不超过 70 字）。');
  if (!slugPattern(info.id)) fail('作品编号须为 2–64 位小写字母、数字和连字符。');
  if (!['3D教师演示', '3D学生操作', '数字工具'].includes(info.type)) fail('请选择有效的作品类别。');
  if (info.password.length < 12) fail('作品解锁密码至少 12 个字符，建议使用随机生成。');
  if (!info.token) fail('请输入 GitHub 细粒度授权令牌。');
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
async function encryptHtml(html, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'}, material, {name:'AES-GCM',length:256}, false, ['encrypt']);
  const cipher = await crypto.subtle.encrypt({name:'AES-GCM',iv,tagLength:128}, key, new TextEncoder().encode(html));
  const record = {
    version: 1,
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 310000,
    salt: asBase64(salt),
    iv: asBase64(iv),
    data: asBase64(new Uint8Array(cipher))
  };
  return JSON.stringify(record) + '\n';
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
async function publish(event) {
  event.preventDefault();
  if (busy) return;
  const file = fileInput.files?.[0], cover = coverInput.files?.[0] || null;
  const info = {
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
  try { validate(info, file, cover); } catch(error) { feedback(error.message); return; }
  if (!window.isSecureContext || !crypto?.subtle) { feedback('请通过 HTTPS 打开页面，并使用支持 Web Crypto 的现代浏览器。'); return; }
  busy = true;
  button.disabled = true;
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
    const encrypted = await encryptHtml(html, info.password);
    // The public GitHub git blob must remain below 100 MiB.
    if (new Blob([encrypted]).size >= 95 * 1024 * 1024) fail('加密结果超出安全上传范围，请缩小作品。');
    setStage('3 / 5 · 上传加密文件', '正在传输密文，视网络情况可能需要几分钟；请保持页面打开', 48);
    const encryptedSha = await createBlob(info.token, encrypted);
    const treeEntries = [{path:'encrypted/' + info.id + '.json',mode:'100644',type:'blob',sha:encryptedSha}];
    let coverPath = existingIndex >= 0 ? catalog[existingIndex].cover : './covers/demo-cube.svg';
    if (cover) {
      setStage('3 / 5 · 上传公开封面', '仅封面会公开显示；请不要包含敏感信息', 60);
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
    setStage('4 / 5 · 更新作品目录', '将加密文件和公开目录合并为同一 GitHub 提交', 72);
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
    $('commit-link').href = 'https://github.com/' + OWNER + '/' + REPO + '/commit/' + commit.sha;
    lastRecord = {title:info.title,id:info.id,grade:info.grade,type:info.type,version:info.version,password:info.password,date:localDate(),size:bytesLabel(file.size)};
    $('success').scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch(error) {
    feedback(error?.message || '发布未完成，请检查文件与网络后重试。');
    setStage('发布未完成', '请检查提示。已上传但未提交的密文不会出现在作品展厅。', 0);
  } finally {
    busy = false;
    button.disabled = false;
    button.textContent = '加密并发布 ↗';
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
    '发布状态：已发布',
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
})();