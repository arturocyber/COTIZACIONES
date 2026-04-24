// ═══════════════════════════════════════════════════════
// FIREBASE — Paste config from Firebase Console
// ═══════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey:            "AIzaSyCrMDypePqT2lVE0Ugy1iUi6cJLv5RWMOI",
  authDomain:        "invactemplate.firebaseapp.com",
  projectId:         "invactemplate",
  storageBucket:     "invactemplate.firebasestorage.app",
  messagingSenderId: "1000829890571",
  appId:             "1:1000829890571:web:e69fc0211f29ea13e7970e"
};
// Firebase will initialize only if config is filled
let fbEnabled = false;
let fbDb = null;
let fbAuth = null;
if(firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    firebase.initializeApp(firebaseConfig);
    fbDb = firebase.firestore();
    fbAuth = firebase.auth();
    fbEnabled = true;
    console.log('Firebase connected ✓');
  } catch(e) { console.warn('Firebase init failed:', e); }
} else {
  console.log('Firebase not configured — using localStorage only');
}

// ── AUTH ──
function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  if(!email || !pass) { errEl.textContent = 'Complete ambos campos'; return; }
  if(!fbAuth) { errEl.textContent = 'Firebase no configurado'; return; }

  document.getElementById('loginBtn').textContent = 'Ingresando...';
  fbAuth.signInWithEmailAndPassword(email, pass)
    .then(() => { showApp(); })
    .catch(err => {
      document.getElementById('loginBtn').textContent = 'Ingresar';
      if(err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errEl.textContent = 'Correo o contraseña incorrecta';
      } else if(err.code === 'auth/invalid-email') {
        errEl.textContent = 'Correo inválido';
      } else {
        errEl.textContent = 'Error: ' + err.message;
      }
    });
}

function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appMain').style.display = '';
}

// Check if already logged in
if(fbAuth) {
  fbAuth.onAuthStateChanged(user => {
    if(user) { showApp(); }
  });
}

// Enter key on login fields
document.getElementById('loginPass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
document.getElementById('loginEmail').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('loginPass').focus(); });

function doLogout() {
  if(fbAuth) fbAuth.signOut();
  document.getElementById('appMain').style.display = 'none';
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').textContent = '';
}

// ── INIT ──
const today = new Date();
document.getElementById('f_date').value = today.toISOString().split('T')[0];

// Prepared-by toggle
document.getElementById('f_preparedBy').addEventListener('change', function(){
  document.getElementById('customPreparedWrap').style.display = this.value === '' ? 'block' : 'none';
});

// Default due date (30 days)
const due = new Date(today); due.setDate(due.getDate() + 30);
document.getElementById('f_dueDate').value = due.toISOString().split('T')[0];

// ── DOC TYPE TOGGLE ──
function getDocType() { return document.getElementById('f_docType').value; }

function switchDocType() {
  const t = getDocType();
  const isFact = t === 'factura';
  document.getElementById('facturaFields').style.display = isFact ? 'block' : 'none';
  document.getElementById('lblDocSection').textContent = isFact ? 'Datos de Factura' : 'Datos de Cotización';
  document.getElementById('lblDocNum').textContent = isFact ? 'Factura No.' : 'Cotización No.';
  document.querySelector('.app-header p').textContent = isFact ? 'Generador de Factura' : 'Generador de Cotización';
  // Update default number prefix
  const numField = document.getElementById('f_quoteNum');
  if(isFact && numField.value.startsWith('2026-CT')) numField.value = '2026-FT';
  if(!isFact && numField.value.startsWith('2026-FT')) numField.value = '2026-CT';
}

// ── LINE ITEMS ──
let lineItems = [];
let itemIdCounter = 0;

function addLineItem(code='', desc='', qty='', price='') {
  const id = itemIdCounter++;
  lineItems.push({id, code, desc, qty, price});
  renderLineItems();
}

function removeLineItem(id) {
  lineItems = lineItems.filter(i => i.id !== id);
  renderLineItems();
  calcTotals();
}

function renderLineItems() {
  const cur = getCur();
  const container = document.getElementById('lineItemsContainer');
  container.innerHTML = lineItems.map((item, idx) => `
    <div class="line-item" data-id="${item.id}">
      <div class="li-header">
        <span class="li-num">LÍNEA ${idx+1}</span>
        <button class="remove-btn" onclick="removeLineItem(${item.id})">✕</button>
      </div>
      <div class="row-2">
        <div class="field"><label>Código</label><input type="text" value="${esc(item.code)}" placeholder="Ej: MDR-01" onchange="updateItem(${item.id},'code',this.value)"></div>
        <div class="field"><label>Cantidad</label><input type="number" inputmode="decimal" value="${item.qty}" placeholder="0" onchange="updateItem(${item.id},'qty',this.value)" oninput="updateItem(${item.id},'qty',this.value)"></div>
      </div>
      <div class="field"><label>Descripción</label><input type="text" value="${esc(item.desc)}" placeholder="Descripción del servicio o producto" onchange="updateItem(${item.id},'desc',this.value)"></div>
      <div class="row-2">
        <div class="field"><label>Precio Unit. ${cur.code}</label><input type="number" inputmode="decimal" step="0.01" value="${item.price}" placeholder="0.00" onchange="updateItem(${item.id},'price',this.value)" oninput="updateItem(${item.id},'price',this.value)"></div>
        <div class="field"><label>Importe ${cur.code}</label>
          <div class="li-total" id="liTotal_${item.id}">${cur.sym}${calcLineTotal(item)}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function getCur() {
  const c = document.getElementById('f_currency').value;
  return c === 'DOP' ? {code:'$RD',sym:'RD$'} : {code:'USD',sym:'$'};
}

function fmtMoney(n) {
  const cur = getCur();
  return cur.sym + n.toFixed(2);
}

function updateItem(id, field, val) {
  const item = lineItems.find(i => i.id === id);
  if(item) { item[field] = val; }
  const el = document.getElementById('liTotal_'+id);
  if(el && item) el.textContent = fmtMoney(parseFloat(calcLineTotal(item)));
  calcTotals();
}

function calcLineTotal(item) {
  const q = parseFloat(item.qty) || 0;
  const p = parseFloat(item.price) || 0;
  return (q * p).toFixed(2);
}

function calcTotals() {
  const cur = getCur();
  let sub = 0;
  lineItems.forEach(i => { sub += (parseFloat(i.qty)||0) * (parseFloat(i.price)||0); });
  const tax = sub * 0.18;
  const total = sub + tax;
  document.getElementById('dispSubtotal').textContent = fmtMoney(sub);
  document.getElementById('dispTax').textContent = fmtMoney(tax);
  document.getElementById('dispTotal').textContent = fmtMoney(total);
  document.getElementById('lblSubtotal').textContent = 'Subtotal ' + cur.code;
  document.getElementById('lblTotal').textContent = 'Total ' + cur.code;
}

// Start with 3 empty lines
addLineItem(); addLineItem(); addLineItem();

document.getElementById('addLineBtn').addEventListener('click', () => addLineItem());

// ── GET PREPARED BY ──
function getPreparedBy() {
  const sel = document.getElementById('f_preparedBy').value;
  return sel || document.getElementById('f_preparedByCustom').value || '';
}

// ── FORMAT DATE ──
function fmtDate(dateStr) {
  if(!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-DO', {day:'2-digit',month:'long',year:'numeric'});
}

// ── BUILD PDF HTML ──
function buildPdfHtml() {
  const cur = getCur();
  const qNum = document.getElementById('f_quoteNum').value;
  const qDate = document.getElementById('f_date').value;
  const prep = getPreparedBy();
  const compName = document.getElementById('f_companyName').value;
  const rnc = document.getElementById('f_rnc').value;
  const compPhone = document.getElementById('f_companyPhone').value;
  const compEmail = document.getElementById('f_companyEmail').value;
  const compAddress = document.getElementById('f_companyAddress').value;
  const clientRnc = document.getElementById('f_clientRnc').value;
  const projName = document.getElementById('f_projName').value;
  const projLoc = document.getElementById('f_projLocation').value;
  const projContact = document.getElementById('f_projContact').value;
  const projArea = document.getElementById('f_projArea').value;
  const payTerms = document.getElementById('f_payTerms').value;
  const observations = document.getElementById('f_observations').value;
  const contact2 = document.getElementById('f_contact2').value;

  let sub = 0;
  const rows = lineItems.filter(i => i.desc || i.code).map(i => {
    const q = parseFloat(i.qty)||0;
    const p = parseFloat(i.price)||0;
    const imp = q*p; sub += imp;
    return `<tr>
      <td>${i.code||'—'}</td><td>${i.desc||'—'}</td>
      <td>${q}</td><td>${cur.sym}${p.toFixed(2)}</td><td>${cur.sym}${imp.toFixed(2)}</td>
    </tr>`;
  }).join('');
  const tax = sub * 0.18;
  const total = sub + tax;

  return `
    <div class="pdf-bar">
      <div class="left">
        <img src="data:image/png;base64,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" alt="INVERSSYS" style="height:36px;width:auto">
        <div>
          <h2 style="display:none">INVERSSYS</h2>
        </div>
      </div>
      <div class="right">
        ${getDocType() === 'factura' ? 'Factura' : 'Cotización'} No. <strong>${qNum}</strong><br>
        ${fmtDate(qDate)}<br>
        ${prep}
        ${getDocType() === 'factura' && document.getElementById('f_ncf').value ? '<br>NCF: ' + document.getElementById('f_ncf').value : ''}
        ${getDocType() === 'factura' ? '<br>Vence: ' + fmtDate(document.getElementById('f_dueDate').value) : ''}
      </div>
    </div>
    <div class="pdf-body">
      <div class="pdf-meta">
        <div class="pdf-meta-block">
          <h4>Empresa</h4>
          <p>${compName}<br>RNC: ${rnc}<br>${compPhone}<br>${compEmail}<br>${compAddress}</p>
        </div>
        <div class="pdf-meta-block">
          <h4>Proyecto / Cliente</h4>
          <p>${projName||'—'}${clientRnc ? '<br>RNC: '+clientRnc : ''}<br>${projLoc||''}<br>${projContact||''}<br>${projArea ? 'Área: '+projArea : ''}</p>
        </div>
      </div>
      <table class="pdf-table">
        <thead><tr><th>Código</th><th>Descripción</th><th>Cant.</th><th>Precio Unit.</th><th>Importe ${cur.code}</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#999">Sin líneas</td></tr>'}</tbody>
      </table>
      <div class="pdf-totals"><div class="pdf-totals-inner">
        <div class="pdf-tot-row"><span class="l">Subtotal ${cur.code}</span><span class="r">${cur.sym}${sub.toFixed(2)}</span></div>
        <div class="pdf-tot-row"><span class="l">ITBIS 18%</span><span class="r">${cur.sym}${tax.toFixed(2)}</span></div>
        <div class="pdf-tot-row grand"><span class="l">Total ${cur.code}</span><span class="r">${cur.sym}${total.toFixed(2)}</span></div>
      </div></div>
      <div class="pdf-terms">
        <h4>Condiciones de Pago</h4>
        ${getDocType() === 'factura' ? '<p><strong>' + document.getElementById('f_payCondition').value + '</strong></p>' : ''}
        <p>${(payTerms||'').replace(/\n/g,'<br>')}</p>
      </div>
      <div class="pdf-terms" style="border:none;padding-top:12px">
        <h4>Observaciones</h4>
        <p>${(observations||'').replace(/\n/g,'<br>')}</p>
      </div>
      <div class="pdf-sig">
        <div class="pdf-sig-block">
          <img src="data:image/png;base64,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" alt="Sello INVERSSYS" class="pdf-stamp">
          <div class="pdf-sig-line">Firma INVERSSYS</div>
          <div class="pdf-sig-name">${prep}</div>
          ${contact2 ? '<div class="pdf-sig-name">' + contact2 + '</div>' : ''}
        </div>
        <div class="pdf-sig-block">
          <div style="height:80px"></div>
          <div class="pdf-sig-line">Firma Cliente</div>
          <div class="pdf-sig-name">${projContact || ''}</div>
        </div>
      </div>
      <div class="pdf-footer">
        ${compName} · RNC ${rnc} · ${compAddress}, Santo Domingo · ${compEmail} · ${compPhone}
      </div>
    </div>
  `;
}

// ── PREVIEW ──
function showPreview() {
  document.getElementById('pdfRender').innerHTML = buildPdfHtml();
  document.getElementById('previewOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closePreview() {
  document.getElementById('previewOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

// ── PDF DOWNLOAD ──
async function downloadPDF() {
  toast('Generando PDF...');
  try {
    // Create off-screen render container for clean capture
    const offscreen = document.createElement('div');
    offscreen.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;width:680px;';
    offscreen.innerHTML = '<div id="pdfRenderOff" style="background:#fff;color:#1a1a2e;max-width:680px;border-radius:6px;overflow:hidden;font-family:DM Sans,sans-serif;">' + buildPdfHtml() + '</div>';
    document.body.appendChild(offscreen);
    const el = document.getElementById('pdfRenderOff');

    // Wait for images to load
    await new Promise(r => setTimeout(r, 300));

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 680,
      windowWidth: 680
    });

    document.body.removeChild(offscreen);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'letter');
    const pageW = 216; // letter width mm
    const pageH = 279; // letter height mm
    const margin = 10;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= pageH - margin * 2) {
      // Single page
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, imgH);
    } else {
      // Multi-page: slice the canvas
      const usableH = pageH - margin * 2;
      const sliceH = Math.floor((canvas.height * usableH) / imgH);
      let y = 0;
      let page = 0;

      while (y < canvas.height) {
        if (page > 0) pdf.addPage();
        const h = Math.min(sliceH, canvas.height - y);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = h;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        const sliceImgH = (h * imgW) / canvas.width;
        pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, sliceImgH);
        y += h;
        page++;
      }
    }

    const qNum = document.getElementById('f_quoteNum').value || 'cotizacion';
    const projName = document.getElementById('f_projName').value || '';
    const docLabel = getDocType() === 'factura' ? 'Factura' : 'Cotizacion';
    const fname = `INVERSSYS_${docLabel}_${qNum}${projName ? '_'+projName.replace(/\s+/g,'_') : ''}.pdf`;
    pdf.save(fname);
    toast('PDF descargado ✓');
  } catch(e) {
    console.error('PDF error:', e);
    toast('Error generando PDF');
  }
}



// ── TOAST ──
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ── ADMIN PASSWORD ──
const ADMIN_PW = 'inverssys2026';
let pendingPwAction = null;

function openPwModal(action) {
  pendingPwAction = action;
  document.getElementById('pwInput').value = '';
  document.getElementById('pwModal').classList.add('show');
  setTimeout(() => document.getElementById('pwInput').focus(), 100);
}
function closePwModal() {
  document.getElementById('pwModal').classList.remove('show');
  pendingPwAction = null;
}
function submitPw() {
  const pw = document.getElementById('pwInput').value;
  if(pw === ADMIN_PW) {
    const action = pendingPwAction;
    closePwModal();
    if(action) action();
  } else {
    toast('Contraseña incorrecta');
    document.getElementById('pwInput').value = '';
    document.getElementById('pwInput').focus();
  }
}
document.getElementById('pwInput').addEventListener('keydown', e => { if(e.key==='Enter') submitPw(); });

// ── CONFIRM DIALOG ──
function showConfirm(title, msg, onOk) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmModal').classList.add('show');
  const btn = document.getElementById('confirmOk');
  btn.onclick = () => { closeConfirm(); onOk(); };
}
function closeConfirm() { document.getElementById('confirmModal').classList.remove('show'); }

// ── STORAGE ──
const STORE_KEY = 'inverssys_docs';
function loadDocs() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch(e) { return []; }
}
function saveDocs(docs) {
  localStorage.setItem(STORE_KEY, JSON.stringify(docs));
  // Sync to Firebase if enabled
  if(fbEnabled && fbDb) {
    docs.forEach(d => fbDb.collection('cotizaciones').doc(d.id).set(d).catch(()=>{}));
  }
}

// ── COLLECT / LOAD FORM DATA ──
function collectFormData() {
  return {
    docType: getDocType(),
    quoteNum: document.getElementById('f_quoteNum').value,
    date: document.getElementById('f_date').value,
    currency: document.getElementById('f_currency').value,
    ncf: document.getElementById('f_ncf').value,
    dueDate: document.getElementById('f_dueDate').value,
    payCondition: document.getElementById('f_payCondition').value,
    companyName: document.getElementById('f_companyName').value,
    rnc: document.getElementById('f_rnc').value,
    companyPhone: document.getElementById('f_companyPhone').value,
    companyEmail: document.getElementById('f_companyEmail').value,
    companyAddress: document.getElementById('f_companyAddress').value,
    preparedBy: getPreparedBy(),
    contact2: document.getElementById('f_contact2').value,
    clientRnc: document.getElementById('f_clientRnc').value,
    projName: document.getElementById('f_projName').value,
    projLocation: document.getElementById('f_projLocation').value,
    projContact: document.getElementById('f_projContact').value,
    projArea: document.getElementById('f_projArea').value,
    payTerms: document.getElementById('f_payTerms').value,
    observations: document.getElementById('f_observations').value,
    lineItems: lineItems.map(i => ({code:i.code,desc:i.desc,qty:i.qty,price:i.price}))
  };
}

function loadFormData(data) {
  document.getElementById('f_docType').value = data.docType || 'cotizacion';
  switchDocType();
  document.getElementById('f_quoteNum').value = data.quoteNum || '';
  document.getElementById('f_date').value = data.date || '';
  document.getElementById('f_currency').value = data.currency || 'USD';
  document.getElementById('f_ncf').value = data.ncf || '';
  document.getElementById('f_dueDate').value = data.dueDate || '';
  document.getElementById('f_payCondition').value = data.payCondition || 'Crédito 30 días';
  document.getElementById('f_companyName').value = data.companyName || '';
  document.getElementById('f_rnc').value = data.rnc || '';
  document.getElementById('f_companyPhone').value = data.companyPhone || '';
  document.getElementById('f_companyEmail').value = data.companyEmail || '';
  document.getElementById('f_companyAddress').value = data.companyAddress || '';
  const selPrep = document.getElementById('f_preparedBy');
  const opts = Array.from(selPrep.options).map(o=>o.value);
  if(opts.includes(data.preparedBy)) { selPrep.value = data.preparedBy; }
  else { selPrep.value = ''; document.getElementById('f_preparedByCustom').value = data.preparedBy || ''; document.getElementById('customPreparedWrap').style.display='block'; }
  document.getElementById('f_contact2').value = data.contact2 || '';
  document.getElementById('f_clientRnc').value = data.clientRnc || '';
  document.getElementById('f_projName').value = data.projName || '';
  document.getElementById('f_projLocation').value = data.projLocation || '';
  document.getElementById('f_projContact').value = data.projContact || '';
  document.getElementById('f_projArea').value = data.projArea || '';
  document.getElementById('f_payTerms').value = data.payTerms || '';
  document.getElementById('f_observations').value = data.observations || '';
  lineItems = []; itemIdCounter = 0;
  (data.lineItems || []).forEach(li => addLineItem(li.code, li.desc, li.qty, li.price));
  if(lineItems.length === 0) { addLineItem(); addLineItem(); addLineItem(); }
  calcTotals();
}

// ── UI MODES ──
function showCotMode() {
  document.getElementById('actionBarCot').style.display = '';
  document.getElementById('actionBarFac').style.display = 'none';
  document.getElementById('facturaEditSection').classList.remove('active');
  document.querySelector('.nav-tabs').style.display = '';
}
function showFacturaMode() {
  document.getElementById('actionBarCot').style.display = 'none';
  document.getElementById('actionBarFac').style.display = '';
  document.getElementById('facturaEditSection').classList.add('active');
  // Hide all tabs and form sections
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  document.querySelector('.nav-tabs').style.display = 'none';
}
function showHistMode() {
  document.getElementById('actionBarCot').style.display = 'none';
  document.getElementById('actionBarFac').style.display = 'none';
  document.getElementById('facturaEditSection').classList.remove('active');
  document.querySelector('.nav-tabs').style.display = '';
}

function goToTab(tabName) {
  showCotMode();
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  document.querySelector('[data-tab="'+tabName+'"]').classList.add('active');
  document.getElementById('tab-'+tabName).classList.add('active');
  // Hide action bar on historial
  if(tabName === 'historial') showHistMode();
}

// ── COMPLETAR (cotización) ──
let editingId = null;

function completeQuote() {
  const data = collectFormData();
  if(!data.quoteNum) { toast('Falta el número de documento'); return; }
  if(!data.projName) { toast('Falta el nombre del cliente/proyecto'); return; }

  if(data.docType === 'factura') {
    if(!data.clientRnc) { toast('DGII requiere RNC/Cédula del cliente'); return; }
    if(!data.ncf) { toast('DGII requiere NCF para facturas'); return; }
  }

  const label = editingId ? 'Actualizar' : 'Completar';
  showConfirm(label + ' Cotización',
    '¿' + label + ' "' + data.quoteNum + ' — ' + data.projName + '"?',
    async () => {
      const docs = loadDocs();
      const sub = lineItems.reduce((s,i) => s + (parseFloat(i.qty)||0)*(parseFloat(i.price)||0), 0);
      const entry = {
        id: editingId || (Date.now().toString(36) + Math.random().toString(36).substr(2,4)),
        type: 'cotizacion',
        quoteNum: data.quoteNum,
        clientName: data.projName,
        total: sub * 1.18,
        currency: data.currency === 'DOP' ? 'RD$' : '$',
        createdAt: data.date || new Date().toISOString().split('T')[0],
        data: data
      };
      if(editingId) {
        const idx = docs.findIndex(d => d.id === editingId);
        if(idx >= 0) docs[idx] = entry; else docs.unshift(entry);
      } else { docs.unshift(entry); }
      saveDocs(docs);

      toast('Generando PDF...');
      await downloadPDF();
      toast('Cotización ' + (editingId ? 'actualizada ✓' : 'guardada ✓'));
      resetForm();
      histFilter = 'cotizacion';
      renderHistorial();
      goToTab('historial');
    }
  );
}

function resetForm() {
  editingId = null;
  document.getElementById('f_docType').value = 'cotizacion';
  switchDocType();
  document.getElementById('f_quoteNum').value = '2026-CT';
  document.getElementById('f_date').value = new Date().toISOString().split('T')[0];
  document.getElementById('f_ncf').value = '';
  const d2 = new Date(); d2.setDate(d2.getDate()+30);
  document.getElementById('f_dueDate').value = d2.toISOString().split('T')[0];
  document.getElementById('f_clientRnc').value = '';
  document.getElementById('f_projName').value = '';
  document.getElementById('f_projLocation').value = '';
  document.getElementById('f_projContact').value = '';
  document.getElementById('f_projArea').value = '';
  document.getElementById('f_payTerms').value = '50% con la orden de trabajo.\n50% con la entrega.';
  document.getElementById('f_observations').value = 'TIEMPO DE ESPERA 45 DIAS LABORABLES\nPROPUESTA VALIDA POR 7 DIAS.';
  lineItems = []; itemIdCounter = 0;
  addLineItem(); addLineItem(); addLineItem();
  calcTotals();
}

// ── HISTORIAL ──
let histFilter = 'cotizacion';

function filterHist(type, btn) {
  histFilter = type;
  document.querySelectorAll('.hist-filter button').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderHistorial();
}

function renderHistorial() {
  const docs = loadDocs();
  const filtered = docs.filter(d => d.type === histFilter);
  const container = document.getElementById('histList');

  if(filtered.length === 0) {
    container.innerHTML = '<div class="hist-empty">No hay ' + (histFilter==='factura'?'facturas':'cotizaciones') + ' guardadas</div>';
    return;
  }

  container.innerHTML = filtered.map(q => {
    const isFac = q.type === 'factura';
    const badgeClass = isFac ? 'fac' : 'cot';
    const badgeText = isFac ? 'FACTURA' : 'COTIZACIÓN';
    const total = (q.currency||'$') + (q.total||0).toFixed(2);

    let buttons = '';
    if(isFac) {
      buttons = `
        <button class="hist-btn-edit" onclick="editFactura('${q.id}')">Editar</button>
        <button class="hist-btn-delete" onclick="deleteDoc('${q.id}')">Eliminar</button>`;
    } else {
      buttons = `
        <button class="hist-btn-edit" onclick="editCotizacion('${q.id}')">Editar</button>
        <button class="hist-btn-convert" onclick="convertToFactura('${q.id}')">Convertir en Factura</button>`;
    }

    return `
      <div class="hist-item ${isFac?'is-factura':''}">
        <div class="hist-item-top">
          <div>
            <div class="hist-item-num">${esc(q.quoteNum)}</div>
            <div class="hist-item-client">${esc(q.clientName||'—')}</div>
          </div>
          <span class="hist-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="hist-item-meta">
          ${fmtDate(q.createdAt)} · <span class="hist-item-total">${total}</span>
          ${q.data?.ncf ? ' · NCF: '+esc(q.data.ncf) : ''}
        </div>
        <div class="hist-actions">${buttons}</div>
      </div>
    `;
  }).join('');
}

// ── EDIT COTIZACIÓN (loads into form tabs) ──
function editCotizacion(id) {
  openPwModal(() => {
    const docs = loadDocs();
    const doc = docs.find(d => d.id === id);
    if(!doc) { toast('No encontrado'); return; }
    editingId = id;
    loadFormData(doc.data);
    goToTab('empresa');
    toast('Editando: ' + (doc.quoteNum || 'documento'));
  });
}

// ── EDIT FACTURA (dedicated factura platform) ──
let editingFacturaId = null;

function editFactura(id) {
  openPwModal(() => {
    const docs = loadDocs();
    const doc = docs.find(d => d.id === id);
    if(!doc || !doc.data) { toast('No encontrado'); return; }
    editingFacturaId = id;
    const d = doc.data;

    document.getElementById('feTitle').textContent = 'Factura ' + (d.quoteNum || '');
    document.getElementById('feSubtitle').textContent = (d.projName || '') + (d.clientRnc ? ' · RNC: '+d.clientRnc : '');
    document.getElementById('fe_ncf').value = d.ncf || '';
    document.getElementById('fe_date').value = d.date || '';
    document.getElementById('fe_dueDate').value = d.dueDate || '';
    document.getElementById('fe_payCondition').value = d.payCondition || 'Crédito 30 días';
    document.getElementById('fe_clientName').value = d.projName || '';
    document.getElementById('fe_clientRnc').value = d.clientRnc || '';
    document.getElementById('fe_clientContact').value = d.projContact || '';
    document.getElementById('fe_observations').value = d.observations || '';

    // Render line items summary
    const cur = d.currency === 'DOP' ? 'RD$' : '$';
    let sub = 0;
    const itemRows = (d.lineItems || []).map(li => {
      const imp = (parseFloat(li.qty)||0) * (parseFloat(li.price)||0);
      sub += imp;
      return '<div class="fe-row"><span class="label">' + esc(li.desc||'—') + ' × ' + (li.qty||0) + '</span><span class="val">' + cur + imp.toFixed(2) + '</span></div>';
    }).join('');
    const tax = sub * 0.18;
    document.getElementById('feSummary').innerHTML = itemRows +
      '<div class="fe-row"><span class="label">Subtotal</span><span class="val">' + cur + sub.toFixed(2) + '</span></div>' +
      '<div class="fe-row"><span class="label">ITBIS 18%</span><span class="val">' + cur + tax.toFixed(2) + '</span></div>' +
      '<div class="fe-total">' + cur + (sub+tax).toFixed(2) + '</div>';

    showFacturaMode();
    toast('Editando factura');
  });
}

function closeFacturaEdit() {
  editingFacturaId = null;
  showHistMode();
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  document.querySelector('[data-tab="historial"]').classList.add('active');
  document.getElementById('tab-historial').classList.add('active');
  document.querySelector('.nav-tabs').style.display = '';
  histFilter = 'factura';
  document.querySelectorAll('.hist-filter button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.hist-filter button').forEach(b => { if(b.textContent.trim()==='Facturas') b.classList.add('active'); });
  renderHistorial();
}

// ── SAVE FACTURA EDITS ──
function collectFacturaEdits() {
  if(!editingFacturaId) return null;
  const docs = loadDocs();
  const idx = docs.findIndex(d => d.id === editingFacturaId);
  if(idx < 0) return null;
  const doc = docs[idx];
  const d = doc.data;
  d.ncf = document.getElementById('fe_ncf').value;
  d.date = document.getElementById('fe_date').value;
  d.dueDate = document.getElementById('fe_dueDate').value;
  d.payCondition = document.getElementById('fe_payCondition').value;
  d.projName = document.getElementById('fe_clientName').value;
  d.clientRnc = document.getElementById('fe_clientRnc').value;
  d.projContact = document.getElementById('fe_clientContact').value;
  d.observations = document.getElementById('fe_observations').value;
  d.docType = 'factura';
  doc.clientName = d.projName;
  doc.quoteNum = d.quoteNum;
  docs[idx] = doc;
  saveDocs(docs);
  return doc;
}

function saveFacturaEdits() {
  const saved = collectFacturaEdits();
  if(!saved) { toast('No encontrado'); return; }
  toast('Factura guardada ✓');
  closeFacturaEdit();
}

// ── DOWNLOAD FACTURA PDF ──
async function downloadFactura() {
  const saved = collectFacturaEdits();
  if(!saved) { toast('No encontrado'); return; }

  const d = saved.data;
  if(!d.clientRnc) { toast('DGII requiere RNC/Cédula del cliente'); return; }
  if(!d.ncf) { toast('DGII requiere NCF para descargar factura'); return; }

  loadFormData(d);
  toast('Generando Factura PDF...');
  await downloadPDF();
  toast('Factura descargada ✓');
  resetForm();
}

// ── CONVERT COTIZACIÓN → FACTURA ──
function convertToFactura(id) {
  openPwModal(() => {
    const docs = loadDocs();
    const doc = docs.find(d => d.id === id);
    if(!doc) { toast('No encontrado'); return; }

    showConfirm('Convertir en Factura',
      'La cotización "' + doc.quoteNum + '" pasará a Facturas.',
      () => {
        doc.type = 'factura';
        doc.quoteNum = (doc.quoteNum || '').replace('CT', 'FT');
        if(doc.data) {
          doc.data.docType = 'factura';
          doc.data.quoteNum = doc.quoteNum;
          doc.data.ncf = '';
          doc.data.date = new Date().toISOString().split('T')[0];
          const d = new Date(); d.setDate(d.getDate()+30);
          doc.data.dueDate = d.toISOString().split('T')[0];
        }
        saveDocs(docs);
        histFilter = 'factura';
        document.querySelectorAll('.hist-filter button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.hist-filter button').forEach(b => { if(b.textContent.trim()==='Facturas') b.classList.add('active'); });
        renderHistorial();
        toast('Convertida a Factura ✓');
      }
    );
  });
}

// ── DELETE (facturas only) ──
function deleteDoc(id) {
  openPwModal(() => {
    showConfirm('Eliminar Factura', '¿Está seguro? Esta acción no se puede deshacer.', () => {
      let docs = loadDocs();
      docs = docs.filter(d => d.id !== id);
      saveDocs(docs);
      if(fbEnabled && fbDb) fbDb.collection('cotizaciones').doc(id).delete().catch(()=>{});
      renderHistorial();
      toast('Factura eliminada');
    });
  });
}

// ── TAB CLICKS (override to handle action bar) ──
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.removeEventListener('click', tab._handler);
  tab._handler = function() {
    const t = this.dataset.tab;
    document.querySelectorAll('.nav-tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('tab-'+t).classList.add('active');
    document.getElementById('facturaEditSection').classList.remove('active');
    if(t === 'historial') { showHistMode(); document.querySelector('.nav-tabs').style.display = ''; }
    else showCotMode();
    window.scrollTo(0,0);
  };
  tab.addEventListener('click', tab._handler);
});

// ── INIT ──
renderHistorial();
