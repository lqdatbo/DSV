/* app.js — Dashboard behaviour */

let contacts = getContacts();
let editingId = null;
let pendingAvatar = '';

const grid = document.getElementById('grid');
const searchInput = document.getElementById('searchInput');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalTitle = document.getElementById('modalTitle');
const avatarPreview = document.getElementById('avatarPreview');
const toastEl = document.getElementById('toast');

const fName = document.getElementById('fName');
const fTitle = document.getElementById('fTitle');
const fCompany = document.getElementById('fCompany');
const fPhone = document.getElementById('fPhone');
const fEmail = document.getElementById('fEmail');
const fWebsite = document.getElementById('fWebsite');
const fAvatarUrl = document.getElementById('fAvatarUrl');

document.getElementById('baseUrlLabel').textContent = getBaseUrl();

/* ---------------- Render ---------------- */
function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(-2).map(w => w[0]?.toUpperCase() || '').join('');
}

function render() {
  const q = searchInput.value.trim().toLowerCase();
  const list = contacts.filter(c => {
    if (!q) return true;
    return [c.name, c.company, c.title, c.email, c.phone].join(' ').toLowerCase().includes(q);
  });

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty"><strong>${contacts.length === 0 ? 'Chưa có contact nào' : 'Không tìm thấy kết quả'}</strong>${contacts.length === 0 ? 'Nhấn "Create Contact" để bắt đầu, hoặc Import từ JSON/XML.' : 'Thử một từ khoá khác.'}</div>`;
    return;
  }

  grid.innerHTML = list.map(c => `
    <div class="card" data-id="${c.id}">
      <div class="card-head">
        <div class="avatar" style="${c.avatar ? `background-image:url('${c.avatar.replace(/'/g, "%27")}')` : ''}">${c.avatar ? '' : initials(c.name)}</div>
        <div class="card-title">
          <div class="name">${escapeHtml(c.name || 'Chưa có tên')}</div>
          <div class="role">${escapeHtml([c.title, c.company].filter(Boolean).join(' · '))}</div>
        </div>
      </div>
      <div class="card-fields">
        ${c.phone ? `<div>📞 ${escapeHtml(c.phone)}</div>` : ''}
        ${c.email ? `<div>✉️ ${escapeHtml(c.email)}</div>` : ''}
        ${c.website ? `<div>🌐 ${escapeHtml(c.website)}</div>` : ''}
      </div>
      <div class="card-actions">
        <button class="btn btn-sm" data-act="copy">🔍 Copy NFC URL</button>
        <button class="btn btn-sm" data-act="vcf">📄 VCF</button>
        <button class="btn btn-sm" data-act="edit">✏️ Sửa</button>
        <button class="btn btn-sm btn-danger" data-act="del">🗑 Xoá</button>
      </div>
    </div>
  `).join('');
}

grid.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('.card').dataset.id;
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  const act = btn.dataset.act;
  if (act === 'copy') copyNfcUrl(c);
  if (act === 'vcf') downloadVCF(c);
  if (act === 'edit') openModal(c);
  if (act === 'del') deleteContact(c);
});

/* ---------------- Search ---------------- */
searchInput.addEventListener('input', render);

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ---------------- Copy NFC URL ---------------- */
async function copyNfcUrl(c) {
  const url = buildNfcUrl(c);
  try {
    await navigator.clipboard.writeText(url);
    toast('Đã copy NFC URL vào clipboard');
  } catch (e) {
    prompt('Copy URL bên dưới:', url);
  }
}

/* ---------------- Delete ---------------- */
function deleteContact(c) {
  if (!confirm(`Xoá contact "${c.name}"?`)) return;
  contacts = contacts.filter(x => x.id !== c.id);
  saveContacts(contacts);
  render();
  toast('Đã xoá contact');
}

/* ---------------- Modal (create / edit) ---------------- */
document.getElementById('createBtn').addEventListener('click', () => openModal(null));
document.getElementById('cancelBtn').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

function openModal(c) {
  editingId = c ? c.id : null;
  pendingAvatar = c ? (c.avatar || '') : '';
  modalTitle.textContent = c ? 'Sửa contact' : 'Tạo contact mới';
  fName.value = c?.name || '';
  fTitle.value = c?.title || '';
  fCompany.value = c?.company || '';
  fPhone.value = c?.phone || '';
  fEmail.value = c?.email || '';
  fWebsite.value = c?.website || '';
  fAvatarUrl.value = (c?.avatar && !c.avatar.startsWith('data:')) ? c.avatar : '';
  updateAvatarPreview();
  modalBackdrop.hidden = false;
  fName.focus();
}
function closeModal() { modalBackdrop.hidden = true; }

function updateAvatarPreview() {
  const url = pendingAvatar || fAvatarUrl.value;
  if (url) {
    avatarPreview.style.backgroundImage = `url('${url.replace(/'/g, "%27")}')`;
    avatarPreview.textContent = '';
  } else {
    avatarPreview.style.backgroundImage = '';
    avatarPreview.textContent = initials(fName.value) || '?';
  }
}
fName.addEventListener('input', updateAvatarPreview);
fAvatarUrl.addEventListener('input', () => { pendingAvatar = ''; updateAvatarPreview(); });

/* Compress uploaded avatar to a small base64 thumbnail */
document.getElementById('avatarFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const size = 160;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      pendingAvatar = canvas.toDataURL('image/jpeg', 0.65);
      fAvatarUrl.value = '';
      updateAvatarPreview();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const name = fName.value.trim();
  if (!name) { toast('Vui lòng nhập tên'); fName.focus(); return; }

  const avatar = pendingAvatar || fAvatarUrl.value.trim();
  const data = {
    name,
    title: fTitle.value.trim(),
    company: fCompany.value.trim(),
    phone: fPhone.value.trim(),
    email: fEmail.value.trim(),
    website: fWebsite.value.trim(),
    avatar
  };

  if (editingId) {
    contacts = contacts.map(c => c.id === editingId ? { ...c, ...data } : c);
    toast('Đã cập nhật contact');
  } else {
    contacts.push({ id: genId(), ...data });
    toast('Đã tạo contact');
  }
  saveContacts(contacts);
  closeModal();
  render();
});

/* ---------------- Export JSON ---------------- */
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(contacts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'contacts-export.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast('Đã export JSON');
});

/* ---------------- Import JSON / XML ---------------- */
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      let imported = [];
      if (file.name.toLowerCase().endsWith('.xml')) {
        imported = parseContactsXml(ev.target.result);
      } else {
        const parsed = JSON.parse(ev.target.result);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        imported = arr.map(c => ({
          id: c.id || genId(),
          name: c.name || '', title: c.title || '', company: c.company || '',
          phone: c.phone || '', email: c.email || '', website: c.website || '',
          avatar: c.avatar || ''
        }));
      }
      if (imported.length === 0) { toast('Không tìm thấy contact nào trong file'); return; }
      contacts = contacts.concat(imported);
      saveContacts(contacts);
      render();
      toast(`Đã import ${imported.length} contact`);
    } catch (err) {
      alert('Không đọc được file: ' + err.message);
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file);
});

render();
