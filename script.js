// =====================
// Autenticación básica (front)
// =====================
(function authBootstrap() {
  const AUTH_KEY = 'auth_session_v1';

  function getSession() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.exp) return null;
      if (Date.now() >= Number(s.exp)) return null;
      return s;
    } catch (_) { return null; }
  }

  function isLoggedIn() { return !!getSession(); }

  function clearSession() {
    try { localStorage.removeItem(AUTH_KEY); } catch (_) {}
  }

  function enforceAuthIfNeeded() {
    try {
      const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      const protectedPages = new Set(['index.html', 'clientes.html', 'trabajos.html']);
      if (file !== 'login.html' && protectedPages.has(file) && !isLoggedIn()) {
        const next = encodeURIComponent(location.href);
        location.replace(`login.html?next=${next}`);
      }
    } catch (_) { /* noop */ }
  }

  function mountAuthNavUI() {
    try {
      const ul = document.querySelector('#site-nav ul');
      if (!ul) return;
      const existing = document.getElementById('auth-nav-item');
      if (existing) existing.remove();
      const li = document.createElement('li');
      li.id = 'auth-nav-item';
      if (isLoggedIn()) {
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = 'Cerrar sesión';
        a.addEventListener('click', (e) => {
          e.preventDefault();
          clearSession();
          try { location.replace('login.html'); } catch (_) { location.href = 'login.html'; }
        });
        li.appendChild(a);
      } else {
        const a = document.createElement('a');
        a.href = 'login.html';
        a.textContent = 'Ingresar';
        li.appendChild(a);
      }
      ul.appendChild(li);
    } catch (_) { /* noop */ }
  }

  // Exponer logout para uso manual
  try { window.logout = function() { clearSession(); try { location.replace('login.html'); } catch (_) { location.href = 'login.html'; } }; } catch (_) {}

  // Ejecutar cuanto antes (redirección si hace falta)
  enforceAuthIfNeeded();
  // Ajustar el nav cuando cargue el DOM
  try { document.addEventListener('DOMContentLoaded', mountAuthNavUI, { once: true }); } catch (_) {}
})();

// Mobile menu toggle
const navToggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('#site-nav');
if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close menu when clicking a link (on mobile)
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    if (nav.classList.contains('open')) {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  }));
}

// Current year in footer
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Improve keyboard UX for <details>
document.querySelectorAll('details > summary').forEach(summary => {
  summary.setAttribute('role', 'button');
  summary.setAttribute('tabindex', '0');
  summary.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      summary.click();
    }
  });
});

// Ocultar header al bajar y mostrar al subir
(function setupHideOnScrollHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  let lastY = window.scrollY;
  const downThreshold = 10;   // sensibilidad para ocultar
  const upThreshold = -5;     // sensibilidad para mostrar (más inmediato)
  const startHideAfter = 120; // no ocultar hasta pasar 120px

  const onScroll = () => {
    const y = window.scrollY;
    const delta = y - lastY;
    const menuOpen = nav?.classList.contains('open');

    if (!menuOpen) {
      // si sube, mostrar rápido
      if (delta <= upThreshold || y <= 0) {
        header.classList.remove('hide');
      }
      // si baja y ya pasó cierto punto, ocultar
      else if (delta >= downThreshold && y > startHideAfter) {
        header.classList.add('hide');
      }
    }

    lastY = y;
  };

  window.addEventListener('scroll', onScroll, { passive: true });
})();

// =====================
// Sección: Clientes
// =====================

const store = {
  clientes: [], // {id, codigo, nombre, apellido, dni, telefono, email, anteojos: [{id, codigo, ...}]}
  nextClienteCodigo: 10000,
  nextAnteojoCodigo: 10000,
};
let selectedClientId = null;

// Persistencia en localStorage
const STORAGE_KEY = 'optica_store_v1';

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) { /* noop */ }
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.clientes)) {
        store.clientes = parsed.clientes;
      }
      if (typeof parsed?.nextClienteCodigo === 'number') store.nextClienteCodigo = parsed.nextClienteCodigo;
      if (typeof parsed?.nextAnteojoCodigo === 'number') store.nextAnteojoCodigo = parsed.nextAnteojoCodigo;
    }
    // No persistimos el cliente seleccionado entre sesiones para evitar registros accidentales
    selectedClientId = null;
  } catch (e) { /* noop */ }
}

loadStore();

// Migración: asegurar códigos numéricos desde 10.000 y en todos los registros
(function migrateCodes() {
  // normalizar existentes
  let maxCli = 9999;
  let maxAnt = 9999;
  for (const c of store.clientes) {
    if (typeof c.codigo !== 'number') {
      // asignar temporal, luego normalizamos con contador
      c.codigo = ++maxCli;
    } else if (c.codigo > maxCli) {
      maxCli = c.codigo;
    }
    if (!Array.isArray(c.anteojos)) c.anteojos = [];
    for (const a of c.anteojos) {
      if (typeof a.codigo !== 'number') {
        a.codigo = ++maxAnt;
      } else if (a.codigo > maxAnt) {
        maxAnt = a.codigo;
      }
    }
  }
  // Establecer siguientes códigos a partir del máximo encontrado o del default 10000
  store.nextClienteCodigo = Math.max(store.nextClienteCodigo || 10000, maxCli + 1, 10000);
  store.nextAnteojoCodigo = Math.max(store.nextAnteojoCodigo || 10000, maxAnt + 1, 10000);
  saveStore();
})();

// Utilidad: limpiar toda la "base de datos" (localStorage)
function clearAllData(confirmFirst = true) {
  try {
    if (confirmFirst) {
      const ok = typeof window !== 'undefined' ? window.confirm('¿Borrar TODOS los datos (clientes y anteojos)? Esta acción no se puede deshacer.') : true;
      if (!ok) return false;
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('optica_pending_edit');
  } catch (_) { /* noop */ }
  // Reiniciar store en memoria por si no recargamos
  store.clientes = [];
  store.nextClienteCodigo = 10000;
  store.nextAnteojoCodigo = 10000;
  selectedClientId = null;
  // Intentar limpiar UI mínima
  try {
    if (typeof renderClienteSeleccionado === 'function') renderClienteSeleccionado();
    const resultados = document.getElementById('resultados-busqueda');
    if (resultados) resultados.innerHTML = '';
  } catch (_) { /* noop */ }
  try { if (typeof saveStore === 'function') saveStore(); } catch (_) {}
  try { window.location.reload(); } catch (_) {}
  return true;
}

// Exponer para uso desde consola
try { window.limpiarBD = () => clearAllData(true); } catch (_) { /* noop */ }

// Migración: agregar campo de estado a anteojos (en-proceso por defecto)
(function migrateEstados() {
  let changed = false;
  for (const c of store.clientes) {
    if (!Array.isArray(c.anteojos)) continue;
    for (const a of c.anteojos) {
      if (!a.estado) { a.estado = 'en-proceso'; changed = true; }
      else if (a.estado === 'terminados') { a.estado = 'espera-cliente'; changed = true; }
    }
  }
  if (changed) saveStore();
})();

// Migración: normalizar teléfonos existentes a formato +549 (si corresponde)
(function migratePhones() {
  let changed = false;
  for (const c of (store.clientes || [])) {
    const prev = c.telefono || '';
    const norm = normalizeArPhone(prev);
    if (prev && norm && prev !== norm) { c.telefono = norm; changed = true; }
  }
  if (changed) saveStore();
})();

// Helpers DOM
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Formateo de precios: 10.000,00
function formatPrice(value) {
  const n = Number(value || 0);
  try {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch (e) {
    // Fallback manual si Intl no está disponible
    const fixed = n.toFixed(2);
    const [ent, dec] = fixed.split('.');
    const withDots = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${withDots},${dec}`;
  }
}

// Normalización de teléfono (Argentina) a formato internacional: +549 + área + número local
function normalizeArPhone(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  let n = raw.replace(/\D+/g, ''); // solo dígitos
  if (!n) return '';

  // Si viene con código de país, quitarlo (+54) y el 9 si ya está
  if (n.startsWith('54')) {
    n = n.slice(2);
    if (n.startsWith('9')) n = n.slice(1);
  }

  // Quitar prefijo de larga distancia "0" si viene
  n = n.replace(/^0+/, '');

  // Muchos escriben móviles como 0AA 15 XXXXXXXX. Quitamos ese 15 tras el código de área (heurística)
  // Casos comunes: 11 15 XXXXXXXX, 2-4 dígitos de área seguido de 15
  if (n.length >= 12) {
    if (n.startsWith('11') && n.slice(2, 4) === '15') {
      n = n.slice(0, 2) + n.slice(4);
    } else if (n.length >= 13 && n.slice(3, 5) === '15') {
      n = n.slice(0, 3) + n.slice(5);
    } else if (n.length >= 14 && n.slice(4, 6) === '15') {
      n = n.slice(0, 4) + n.slice(6);
    }
  }

  // Armar siempre como +549 + área + local (según pedido)
  return '+549' + n;
}

// Formateo de ID/código: 10.000
function formatId(n) {
  const num = Number(n || 0);
  try {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  } catch (e) {
    return String(Math.floor(num)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
}

// Elementos principales
const formRegistrarCliente = $('#form-registrar-cliente');
const msgRegistrarCliente = $('#msg-registrar-cliente');
const formBuscarCliente = $('#form-buscar-cliente');
const resultadosBusqueda = $('#resultados-busqueda');
const clienteSelBox = $('#cliente-seleccionado');
const formRegistrarAnteojo = $('#form-registrar-anteojo');
const msgRegistrarAnteojo = $('#msg-registrar-anteojo');
const listaAnteojos = $('#lista-anteojos');
const statusCliente = $('#status-cliente');

function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function getClienteById(id) {
  return store.clientes.find(c => c.id === id) || null;
}

function setAnteojoFormEnabled(enabled) {
  if (!formRegistrarAnteojo) return;
  $$('input, select, button', formRegistrarAnteojo).forEach(el => {
    if (el.type !== 'button') el.disabled = !enabled;
  });
}

function renderClienteSeleccionado() {
  const cliente = getClienteById(selectedClientId);
  if (!cliente) {
    if (clienteSelBox) clienteSelBox.textContent = 'No hay cliente seleccionado.';
    setAnteojoFormEnabled(false);
    if (listaAnteojos) listaAnteojos.innerHTML = '';
    if (statusCliente) { statusCliente.textContent = 'Cliente no seleccionado'; statusCliente.classList.add('error-text'); }
    return;
  }
  if (clienteSelBox) {
    clienteSelBox.innerHTML = `
      <div><strong>${cliente.apellido}, ${cliente.nombre}</strong></div>
      <div class="anteojo-meta">ID: ${formatId(cliente.codigo)} • DNI: ${cliente.dni} • Tel: ${cliente.telefono || '-'} • Email: ${cliente.email || '-'}</div>
    `;
  }
  setAnteojoFormEnabled(true);
  if (statusCliente) { statusCliente.textContent = `${cliente.apellido}, ${cliente.nombre}`; statusCliente.classList.remove('error-text'); }
  listarAnteojos();
}

// 1) Registrar cliente
function registrarCliente(data) {
  const required = ['nombre','apellido'];
  for (const k of required) if (!data[k] || String(data[k]).trim() === '') {
    throw new Error('Completa nombre y apellido.');
  }
  const dni = String(data.dni || '').trim();
  if (dni && store.clientes.some(c => (c.dni || '').trim() === dni)) {
    throw new Error('Ya existe un cliente con ese DNI.');
  }
  const cliente = {
    id: genId(),
    codigo: store.nextClienteCodigo++,
    nombre: String(data.nombre).trim(),
    apellido: String(data.apellido).trim(),
    dni,
    telefono: normalizeArPhone(data.telefono),
    email: String(data.email || '').trim(),
    anteojos: [],
  };
  store.clientes.push(cliente);
  selectedClientId = cliente.id;
  renderClienteSeleccionado();
  saveStore();
  return cliente;
}

// 2) Buscar cliente (por nombre o DNI)
function buscarClientes(q) {
  const term = String(q || '').trim().toLowerCase();
  if (!term) return [];
  return store.clientes.filter(c =>
    String(c.dni || '').toLowerCase() === term ||
    c.nombre.toLowerCase().includes(term) ||
    c.apellido.toLowerCase().includes(term)
  );
}

function renderResultadosBusqueda(items) {
  if (!resultadosBusqueda) return;
  if (!items.length) {
    resultadosBusqueda.innerHTML = '<div class="muted">Sin resultados.</div>';
    return;
  }
  resultadosBusqueda.innerHTML = items.map(c => `
    <div class="search-item">
      <div>
        <div><strong>${c.apellido}, ${c.nombre}</strong></div>
        <div class="meta">ID: ${formatId(c.codigo)} • DNI: ${c.dni} • ${c.telefono || '-'} • ${c.email || '-'}</div>
      </div>
      <button class="btn" data-select-cliente="${c.id}">Seleccionar</button>
    </div>
  `).join('');

  $$('button[data-select-cliente]').forEach(btn => btn.addEventListener('click', () => {
    selectedClientId = btn.getAttribute('data-select-cliente');
    renderClienteSeleccionado();
    saveStore();
    resultadosBusqueda.innerHTML = '';
  }));
}

// 3) Registrar anteojo para cliente seleccionado
function registrarAnteojo(data) {
  const cliente = getClienteById(selectedClientId);
  if (!cliente) throw new Error('Selecciona un cliente primero.');

  const anteojo = {
    id: genId(),
    codigo: store.nextAnteojoCodigo++,
    fecha: new Date(),
    // eje es el nuevo nombre; se mantiene compatibilidad si llega "grado"
    od: { esf: data.od_esf || '', cil: data.od_cil || '', eje: data.od_eje || data.od_grado || '' },
    oi: { esf: data.oi_esf || '', cil: data.oi_cil || '', eje: data.oi_eje || data.oi_grado || '' },
    marca: data.marca || '',
    ranurado: !!data.ranurado,
    material: data.material || 'ORG',
    filtros: data.filtros || '',
    laboratorio: data.laboratorio || '',
    aclaraciones: data.aclaraciones || '',
    precio: data.precio ? Number(data.precio) : 0,
    senia: data.senia ? Number(data.senia) : 0,
    estado: 'en-proceso',
  };
  cliente.anteojos.unshift(anteojo); // último primero
  listarAnteojos();
  saveStore();
  return anteojo;
}

// 4) Listar anteojos del cliente seleccionado
function listarAnteojos() {
  if (!listaAnteojos) return;
  const cliente = getClienteById(selectedClientId);
  if (!cliente) { listaAnteojos.innerHTML = ''; return; }
  if (!cliente.anteojos.length) {
    listaAnteojos.innerHTML = '<div class="muted">Aún no hay anteojos registrados.</div>';
    return;
  }
  listaAnteojos.innerHTML = cliente.anteojos.map(a => {
    const od_eje = (a.od && (a.od.eje ?? a.od.grado)) || '';
    const oi_eje = (a.oi && (a.oi.eje ?? a.oi.grado)) || '';
    const precioStr = formatPrice(a.precio);
    return `
    <div class="anteojo-item">
      <h4>${a.marca || 'Sin marca'} <span class="anteojo-meta">• ID ${formatId(a.codigo)} • ${a.material}${a.ranurado ? ' • Ranurado' : ''} • $${precioStr}</span></h4>
      <div class="anteojo-meta">OD: esf=${a.od?.esf || '-'} cil=${a.od?.cil || '-'} eje=${od_eje || '-'} | OI: esf=${a.oi?.esf || '-'} cil=${a.oi?.cil || '-'} eje=${oi_eje || '-'}</div>
      <div class="anteojo-meta">Laboratorio: ${a.laboratorio || '-'} • Filtros: ${a.filtros || '-'}</div>
      ${a.aclaraciones ? `<div class="anteojo-meta">Aclaraciones: ${a.aclaraciones}</div>` : ''}
      <div class="anteojo-actions">
        <button class="btn ghost" data-print-anteojo="${a.id}">Imprimir</button>
        <button class="btn secondary" data-edit-anteojo="${a.id}">Modificar</button>
        <button class="btn danger" data-delete-anteojo="${a.id}">Eliminar</button>
      </div>
    </div>
  `}).join('');

  $$('button[data-print-anteojo]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-print-anteojo');
    imprimirAnteojo(id);
  }));

  $$('button[data-edit-anteojo]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-edit-anteojo');
    iniciarEdicionAnteojo(id);
  }));

  $$('button[data-delete-anteojo]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-delete-anteojo');
    eliminarAnteojo(id);
  }));
}

// 5) Imprimir datos (cliente + anteojo)
function imprimirAnteojo(anteojoId, overrideClienteId) {
  let cliente = overrideClienteId ? getClienteById(overrideClienteId) : getClienteById(selectedClientId);
  let a = null;
  if (cliente) {
    a = cliente.anteojos.find(x => x.id === anteojoId);
  }
  // Si no hay cliente seleccionado o no se encontró el anteojo en él, buscar globalmente
  if (!a) {
    for (const c of store.clientes) {
      const found = (c.anteojos || []).find(x => x.id === anteojoId);
      if (found) { cliente = c; a = found; break; }
    }
  }
  if (!cliente || !a) return alert('No se encontró el anteojo para imprimir.');
  const win = window.open('', '_blank');
  if (!win) return alert('No se pudo abrir la ventana de impresión');
  const d = new Date(a.fecha);
  const pad = (n) => String(n).padStart(2, '0');
  const fechaStr = `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
  const od_eje = (a.od && (a.od.eje ?? a.od.grado)) || '';
  const oi_eje = (a.oi && (a.oi.eje ?? a.oi.grado)) || '';
  const precioStr = formatPrice(a.precio);
  const seniaStr = formatPrice(a.senia || 0);
  const totalStr = formatPrice((a.precio || 0) - (a.senia || 0));
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Impresión anteojo</title>
    <style>
      @page { size: A4; margin: 18mm; }
      body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 0; }
      h2 { margin: 0 0 8px; font-size: 22px; }
      .label { font-weight: 700; }
      .page-date { margin: 0 0 18px; font-weight: 700; }
      .block { margin: 0 0 28px; }
      .ind { margin-left: 36px; }
      .sep { margin: 0 6px; color: #666; }
      .cut { border-top: 1px dashed #aaa; margin: 18px 0; }
    </style>
  </head><body>
    <div class="page-date"><span class="label">Fecha :</span> ${fechaStr} (Día/mes/año)</div>

    <div class="block summary">
      <h2>Cliente: ${cliente.apellido}, ${cliente.nombre} | <span class="label">ID [${formatId(cliente.codigo)}]</span></h2>
      <div><span class="label">Precio:</span> $${precioStr}</div>
      <div><span class="label">Seña:</span> $${seniaStr}</div>
      <div><span class="label">Total:</span> $${totalStr}</div>
    </div>

    <div class="cut"></div>

    <div class="block detail">
      <h2>Cliente: ${cliente.apellido}, ${cliente.nombre} | <span class="label">ID [${formatId(cliente.codigo)}]</span></h2>
      <div><span class="label">Marca:</span> ${a.marca || '-'}</div>
      <div class="label" style="margin-top:8px;">Graduación:</div>
      <div class="ind">OD: esf=${a.od.esf || '-'}  cil=${a.od.cil || '-'}  eje=${od_eje || '-'}</div>
      <div class="ind">OI: &nbsp;esf=${a.oi.esf || '-'}  cil=${a.oi.cil || '-'}  eje=${oi_eje || '-'}</div>
      <div style="margin-top:8px;"><span class="label">Material:</span> ${a.material}${a.ranurado ? ' • Ranurado' : ''} <span class="sep">|</span> <span class="label">Filtros:</span> ${a.filtros || '-'}</div>
      <div><span class="label">Laboratorio:</span> ${a.laboratorio || '-'}</div>
      <div><span class="label">Fecha :</span> ${fechaStr} (Día/mes/año)</div>
      <div style="margin-top:8px;"><span class="label">Precio:</span> $${precioStr}</div>
      <div><span class="label">Seña:</span> $${seniaStr}</div>
      <div><span class="label">Total:</span> $${totalStr}</div>
    </div>

    <div class="cut"></div>

    <div class="block mini">
      <h2>Cliente: ${cliente.apellido} | <span class="label">ID [${formatId(cliente.codigo)}]</span></h2>
      <div class="label" style="margin-top:8px;">Graduación:</div>
      <div class="ind">OD: esf=${a.od.esf || '-'}  cil=${a.od.cil || '-'}  eje=${od_eje || '-'}</div>
      <div class="ind">OI: &nbsp;esf=${a.oi.esf || '-'}  cil=${a.oi.cil || '-'}  eje=${oi_eje || '-'}</div>
      <div style="margin-top:8px;"><span class="label">Material:</span> ${a.material}${a.ranurado ? ' • Ranurado' : ''} <span class="sep">|</span> <span class="label">Filtros:</span> ${a.filtros || '-'}</div>
      <div><span class="label">Laboratorio:</span> ${a.laboratorio || '-'}</div>
    </div>

    <script>window.onload = () => window.print();<\/script>
  </body></html>`);
  win.document.close();
}

// Eliminar anteojo del cliente seleccionado
function eliminarAnteojo(anteojoId) {
  const cliente = getClienteById(selectedClientId);
  if (!cliente) return;
  const idx = cliente.anteojos.findIndex(x => x.id === anteojoId);
  if (idx === -1) return;
  const a = cliente.anteojos[idx];
  const ok = confirm(`¿Eliminar el anteojo ID ${formatId(a.codigo)} (${a.marca || 'Sin marca'})?`);
  if (!ok) return;
  cliente.anteojos.splice(idx, 1);
  listarAnteojos();
  saveStore();
}

// Edición de anteojo usando el formulario principal
let editingAnteojoId = null;
function iniciarEdicionAnteojo(anteojoId) {
  const cliente = getClienteById(selectedClientId);
  if (!cliente) return;
  const a = cliente.anteojos.find(x => x.id === anteojoId);
  if (!a || !formRegistrarAnteojo) return;
  editingAnteojoId = anteojoId;
  formRegistrarAnteojo.querySelector('[name="od_esf"]').value = a.od?.esf || '';
  formRegistrarAnteojo.querySelector('[name="od_cil"]').value = a.od?.cil || '';
  formRegistrarAnteojo.querySelector('[name="od_eje"]').value = (a.od?.eje ?? a.od?.grado) || '';
  formRegistrarAnteojo.querySelector('[name="oi_esf"]').value = a.oi?.esf || '';
  formRegistrarAnteojo.querySelector('[name="oi_cil"]').value = a.oi?.cil || '';
  formRegistrarAnteojo.querySelector('[name="oi_eje"]').value = (a.oi?.eje ?? a.oi?.grado) || '';
  formRegistrarAnteojo.querySelector('[name="marca"]').value = a.marca || '';
  formRegistrarAnteojo.querySelector('[name="material"]').value = a.material || 'ORG';
  formRegistrarAnteojo.querySelector('[name="laboratorio"]').value = a.laboratorio || 'OPTICAL CRAFT';
  formRegistrarAnteojo.querySelector('[name="filtros"]').value = a.filtros || '';
  formRegistrarAnteojo.querySelector('[name="aclaraciones"]').value = a.aclaraciones || '';
  formRegistrarAnteojo.querySelector('[name="precio"]').value = a.precio || '';
  formRegistrarAnteojo.querySelector('[name="senia"]').value = a.senia || '';
  formRegistrarAnteojo.querySelector('[name="ranurado"]').checked = !!a.ranurado;
  const submitBtn = formRegistrarAnteojo.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Guardar cambios';
  if (msgRegistrarAnteojo) msgRegistrarAnteojo.textContent = `Editando anteojo ID ${formatId(a.codigo)} — Modifica y presiona Enter hasta guardar.`;
  formRegistrarAnteojo.querySelector('[name="od_esf"]').focus();
}

// Wire eventos
if (formRegistrarCliente) {
  formRegistrarCliente.addEventListener('submit', (e) => {
    e.preventDefault();
    msgRegistrarCliente.textContent = '';
    const fd = new FormData(formRegistrarCliente);
    const data = Object.fromEntries(fd.entries());
    try {
      const c = registrarCliente(data);
      msgRegistrarCliente.textContent = `Cliente registrado: ${c.apellido}, ${c.nombre}`;
      formRegistrarCliente.reset();
    } catch (err) {
      msgRegistrarCliente.textContent = err.message || String(err);
    }
  });
}

if (formBuscarCliente) {
  formBuscarCliente.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#buscar-q')?.value || '';
    const items = buscarClientes(q);
    renderResultadosBusqueda(items);
  });
}

if (formRegistrarAnteojo) {
  // habilita si había un cliente seleccionado desde localStorage
  setAnteojoFormEnabled(!!selectedClientId);
  // Inicializa el aviso según estado actual
  renderClienteSeleccionado();
  formRegistrarAnteojo.addEventListener('submit', (e) => {
    e.preventDefault();
    msgRegistrarAnteojo.textContent = '';
    const fd = new FormData(formRegistrarAnteojo);
    const raw = Object.fromEntries(fd.entries());
    raw.ranurado = formRegistrarAnteojo.querySelector('input[name="ranurado"]').checked;
    try {
      if (editingAnteojoId) {
        const cliente = getClienteById(selectedClientId);
        const idx = cliente?.anteojos.findIndex(x => x.id === editingAnteojoId);
        if (cliente && idx >= 0) {
          const original = cliente.anteojos[idx];
          cliente.anteojos[idx] = {
            ...original,
            od: { esf: raw.od_esf || '', cil: raw.od_cil || '', eje: raw.od_eje || '' },
            oi: { esf: raw.oi_esf || '', cil: raw.oi_cil || '', eje: raw.oi_eje || '' },
            marca: raw.marca || '',
            ranurado: !!raw.ranurado,
            material: raw.material || 'ORG',
            laboratorio: raw.laboratorio || '',
            filtros: raw.filtros || '',
            aclaraciones: raw.aclaraciones || '',
            precio: raw.precio ? Number(raw.precio) : 0,
            senia: raw.senia ? Number(raw.senia) : 0,
          };
          saveStore();
          listarAnteojos();
          msgRegistrarAnteojo.textContent = 'Cambios guardados.';
        }
        editingAnteojoId = null;
        const submitBtn = formRegistrarAnteojo.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Agregar anteojo';
        formRegistrarAnteojo.reset();
      } else {
        registrarAnteojo(raw);
        msgRegistrarAnteojo.textContent = 'Anteojo agregado correctamente.';
        formRegistrarAnteojo.reset();
      }
    } catch (err) {
      msgRegistrarAnteojo.textContent = err.message || String(err);
    }
  });

  // Navegación con Enter en orden de campos
  const orderNames = ['od_esf','od_cil','od_eje','oi_esf','oi_cil','oi_eje','marca','material','filtros','laboratorio','precio','senia','aclaraciones','ranurado'];
  const orderEls = orderNames.map(name => formRegistrarAnteojo.querySelector(`[name="${name}"]`)).filter(Boolean);
  formRegistrarAnteojo.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return; // Shift+Enter permite salto de línea
    const targetIndex = orderEls.indexOf(e.target);
    if (targetIndex === -1) return;
    e.preventDefault();
    const next = orderEls[targetIndex + 1];
    if (next) {
      if (next.type === 'checkbox') {
        next.focus();
      } else {
        next.focus();
        if (next.select) { try { next.select(); } catch (_) {} }
      }
    } else {
      // último: enviar formulario
      const submitBtn = formRegistrarAnteojo.querySelector('button[type="submit"]');
      submitBtn?.click();
    }
  });
}

// Si venimos desde Trabajos con una edición pendiente
(function handlePendingEditFromTrabajos() {
  try {
    const hasForm = !!document.getElementById('form-registrar-anteojo');
    if (!hasForm) return; // solo aplica en index.html
    const raw = localStorage.getItem('optica_pending_edit');
    if (!raw) return;
    const data = JSON.parse(raw);
    localStorage.removeItem('optica_pending_edit');
    if (!data || !data.anteojoId || !data.clienteId) return;
    const cliente = getClienteById(data.clienteId);
    if (!cliente) return;
    selectedClientId = cliente.id;
    renderClienteSeleccionado();
    try { iniciarEdicionAnteojo?.(data.anteojoId); } catch (_) { /* noop */ }
  } catch (_) { /* noop */ }
})();
