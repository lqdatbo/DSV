/* common.js — shared utilities for the NFC Contact Cards site
   No server, no database: everything lives in localStorage (dashboard)
   or is encoded straight into the shared URL (public card). */

const CONTACTS_KEY = 'nfc_contacts_v1';
const SETTINGS_KEY = 'nfc_settings_v1';

/* ---------------- Storage ---------------- */
function getContacts() {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY)) || []; }
  catch (e) { return []; }
}
function saveContacts(list) {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
}
function getSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
function getBaseUrl() {
  const s = getSettings();
  if (s.baseUrl) return s.baseUrl.replace(/\/+$/, '');
  const path = window.location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '');
  return window.location.origin + path;
}

/* ---------------- IDs ---------------- */
function genId() {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------------- Base64URL (UTF-8 safe) ---------------- */
function encodeData(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeData(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const json = decodeURIComponent(escape(atob(b64)));
  return JSON.parse(json);
}

/* ---------------- vCard ---------------- */
function escVCard(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}
function buildVCard(c) {
  const L = ['BEGIN:VCARD', 'VERSION:3.0'];
  L.push(`FN:${escVCard(c.name)}`);
  L.push(`N:${escVCard(c.name)};;;;`);
  if (c.title) L.push(`TITLE:${escVCard(c.title)}`);
  if (c.company) L.push(`ORG:${escVCard(c.company)}`);
  if (c.phone) L.push(`TEL;TYPE=CELL,VOICE:${escVCard(c.phone)}`);
  if (c.email) L.push(`EMAIL;TYPE=INTERNET:${escVCard(c.email)}`);
  if (c.website) L.push(`URL:${escVCard(c.website)}`);
  if (c.avatar && c.avatar.startsWith('data:image')) {
    const m = c.avatar.match(/^data:image\/(\w+);base64,(.*)$/);
    if (m) L.push(`PHOTO;ENCODING=b;TYPE=${m[1].toUpperCase()}:${m[2]}`);
  }
  L.push('END:VCARD');
  return L.join('\r\n');
}
function downloadVCF(c) {
  const blob = new Blob([buildVCard(c)], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(c.name || 'contact').trim().replace(/\s+/g, '_')}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- Shareable NFC URL ---------------- */
/* Short keys (n/t/c/p/e/w/a) keep the URL — and therefore the NFC tag
   payload — as small as possible. */
function buildNfcUrl(c) {
  const payload = {
    n: c.name || '', t: c.title || '', c: c.company || '',
    p: c.phone || '', e: c.email || '', w: c.website || '',
    a: c.avatar || ''
  };
  return `${getBaseUrl()}/contact.html?d=${encodeData(payload)}`;
}
function contactFromPayload(p) {
  return {
    name: p.n || '', title: p.t || '', company: p.c || '',
    phone: p.p || '', email: p.e || '', website: p.w || '',
    avatar: p.a || ''
  };
}

/* ---------------- XML import ----------------
   <contacts>
     <contact>
       <name></name><title></title><company></company>
       <phone></phone><email></email><website></website>
       <avatar></avatar>  <!-- optional: image URL -->
     </contact>
   </contacts>
*/
function parseContactsXml(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('File XML không hợp lệ');
  const nodes = xml.querySelectorAll('contact');
  const out = [];
  nodes.forEach(node => {
    const get = (tag) => (node.querySelector(tag)?.textContent || '').trim();
    out.push({
      id: genId(),
      name: get('name'), title: get('title'), company: get('company'),
      phone: get('phone'), email: get('email'), website: get('website'),
      avatar: get('avatar')
    });
  });
  return out;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
