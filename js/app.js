(function() {
  'use strict';

  // ---- NAVEGACIÓN ----
  const sections = document.querySelectorAll('.section');
  const navItems = document.querySelectorAll('.nav-item');

  function showSection(id) {
    sections.forEach(s => s.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));
    const section = document.getElementById('section-' + id);
    if (section) section.classList.add('active');
    const nav = document.querySelector(`.nav-item[data-section="${id}"]`);
    if (nav) nav.classList.add('active');
    if (id === 'productos') renderProductos();
    if (id === 'listas') renderListas();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => showSection(item.dataset.section));
  });

  // ---- UTILIDADES ----
  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function getStatusBadge(status) {
    const map = { pendiente: 'badge-warning', parcial: 'badge-info', completado: 'badge-success' };
    const labels = { pendiente: 'Pendiente', parcial: 'Parcial', completado: 'Completado' };
    return `<span class="badge ${map[status] || 'badge-warning'}">${labels[status] || status}</span>`;
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
  }

  function formatPrice(n) {
    return (Number(n) || 0).toFixed(2) + ' €';
  }

  // ---- MODO OSCURO ----
  const darkToggle = document.getElementById('dark-toggle');
  let darkMode = localStorage.getItem('darkMode') === 'true';

  function applyDark(enable) {
    document.body.classList.toggle('dark', enable);
    darkToggle.textContent = enable ? '☀️' : '🌙';
    localStorage.setItem('darkMode', enable);
  }
  darkToggle.addEventListener('click', () => { darkMode = !darkMode; applyDark(darkMode); });
  applyDark(darkMode);

  // ---- EXPORTAR / IMPORTAR ----
  document.getElementById('btn-exportar').addEventListener('click', async () => {
    try {
      const [productos, proveedores, listas, pedidos] = await Promise.all([
        DB.productos.getAll(), DB.proveedores.getAll(), DB.listas.getAll(), DB.pedidos.getAll()
      ]);
      const data = { exportado: new Date().toISOString(), productos, proveedores, listas, pedidos };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'pedidos-backup.json'; a.click();
      URL.revokeObjectURL(url);
      showToast('Datos exportados');
    } catch (e) { showToast('Error al exportar'); }
  });

  document.getElementById('btn-importar').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.productos || !data.proveedores || !data.listas || !data.pedidos) {
        showToast('Archivo no válido'); return;
      }
      if (!confirm('¿Importar datos? Se añadirán a los existentes.')) return;
      for (const p of data.productos) await DB.productos.add({ nombre: p.nombre, categoria: p.categoria || '', unidad: p.unidad || 'ud', precio: p.precio || 0 });
      for (const p of data.proveedores) await DB.proveedores.add({ nombre: p.nombre, telefono: p.telefono || '', notas: p.notas || '' });
      for (const l of data.listas) await DB.listas.add({ nombre: l.nombre, items: l.items || [], proveedorId: l.proveedorId || null });
      for (const p of data.pedidos) await DB.pedidos.add({ proveedorId: p.proveedorId, proveedorNombre: p.proveedorNombre, items: p.items || [], estado: 'pendiente' });
      showToast('Datos importados');
      renderDashboard(); renderProductos(); renderProveedores(); renderListas(); renderPedidos();
    } catch (e) { showToast('Error al importar'); }
    e.target.value = '';
  });

  // ---- ESCÁNER DE CÓDIGO DE BARRAS ----
  let scannerStream = null;
  let scannerActive = false;

  function startScanner(targetInput) {
    document.getElementById('modal-scanner').classList.add('open');
    document.getElementById('scanner-status').textContent = 'Iniciando cámara...';
    setTimeout(startCamera, 400);
    function startCamera() {
      const container = document.getElementById('scanner-container');
      const status = document.getElementById('scanner-status');
      container.innerHTML = '';
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'environment' } } })
        .catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }))
        .then(stream => {
          scannerStream = stream;
          const video = document.createElement('video');
          video.setAttribute('playsinline', '');
          video.setAttribute('autoplay', '');
          video.srcObject = stream;
          video.style.width = '100%';
          video.style.height = '280px';
          video.style.objectFit = 'cover';
          video.style.borderRadius = '8px';
          video.play();
          container.appendChild(video);
          status.textContent = 'Enfoca al código...';
          scannerActive = true;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          let useNative = 'BarcodeDetector' in window;
          let detector = null;
          if (useNative) {
            detector = new BarcodeDetector({ formats: ['ean_13','ean_8','code_128','code_39','code_93','codabar','itf','upc_a','upc_e','qr_code'] });
          }
          (function scanLoop() {
            if (!scannerActive) return;
            if (video.readyState < 2) { setTimeout(scanLoop, 500); return; }
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            if (useNative) {
              detector.detect(canvas).then(barcodes => {
                if (barcodes.length > 0) {
                  scannerActive = false;
                  stopScanner();
                  document.getElementById('modal-scanner').classList.remove('open');
                  onCodeScanned(barcodes[0].rawValue, targetInput);
                } else {
                  setTimeout(scanLoop, 300);
                }
              }).catch(() => setTimeout(scanLoop, 300));
            } else {
              (function scanLoopFallback() {
                if (!scannerActive) return;
                canvas.toBlob(blob => {
                  if (!blob || !scannerActive) return;
                  const file = new File([blob], 'scan.jpg', { type: 'image/jpeg' });
                  try {
                    const qr = new Html5Qrcode('scanner-hidden');
                    qr.scanFileV2(file, true).then(result => {
                      if (result && result.decodedText) {
                        scannerActive = false;
                        stopScanner();
                        document.getElementById('modal-scanner').classList.remove('open');
                        onCodeScanned(result.decodedText, targetInput);
                      } else {
                        setTimeout(scanLoopFallback, 300);
                      }
                    }).catch(() => setTimeout(scanLoopFallback, 300));
                  } catch(e) { setTimeout(scanLoopFallback, 300); }
                }, 'image/jpeg', 0.8);
              })();
            }
          })();
        })
        .catch(() => { status.textContent = 'Error al acceder a la cámara'; });
    }
  }

  function stopScanner() {
    if (scannerStream) {
      scannerStream.getTracks().forEach(t => t.stop());
      scannerStream = null;
    }
    scannerActive = false;
    const container = document.getElementById('scanner-container');
    if (container) container.innerHTML = '';
  }

  async function onCodeScanned(code, targetInput) {
    if (targetInput === 'form') {
      document.getElementById('producto-codigo').value = code;
      showToast('Código: ' + code);
      return;
    }
    if (targetInput === 'pedido') {
      const productos = await DB.productos.getAll();
      const prod = productos.find(p => p.codigo === code);
      if (!prod) {
        if (confirm('Producto no encontrado. ¿Crear uno con código ' + code + '?')) {
          document.getElementById('producto-codigo').value = code;
          document.getElementById('btn-add-producto').click();
        }
        return;
      }
      const row = document.createElement('div');
      row.className = 'pedido-item-row';
      row.innerHTML = `
        <select class="input pedido-item-select" style="flex:1"><option value="">Seleccionar producto...</option></select>
        <div class="pedido-item-cantidades">
          <label>Pedido: <input type="number" class="input pedido-item-cant" value="1" min="0.1" step="0.1" style="width:65px"></label>
        </div>
        <button type="button" class="btn-icon remove-pedido-item" title="Quitar">❌</button>
      `;
      document.getElementById('pedido-items-container').appendChild(row);
      await loadProductosSelect(row.querySelector('.pedido-item-select'), null);
      row.querySelector('.pedido-item-select').value = prod.id;
      row.querySelector('.pedido-item-select').addEventListener('change', calcPedidoTotal);
      row.querySelector('.pedido-item-cant').addEventListener('input', calcPedidoTotal);
      row.querySelector('.remove-pedido-item').addEventListener('click', () => { row.remove(); calcPedidoTotal(); });
      document.getElementById('pedido-total-group').style.display = 'block';
      calcPedidoTotal();
      showToast('Añadido: ' + prod.nombre);
      return;
    }
    const productos = await DB.productos.getAll();
    const existing = productos.find(p => p.codigo === code);
    if (existing) {
      showToast('Producto encontrado: ' + existing.nombre);
      editProducto(existing.id);
    } else {
      if (confirm('Producto no encontrado. ¿Crear uno con código ' + code + '?')) {
        document.getElementById('producto-codigo').value = code;
        document.getElementById('btn-add-producto').click();
      }
    }
  }

  document.getElementById('btn-scan').addEventListener('click', () => startScanner('list'));
  document.getElementById('btn-scan-form').addEventListener('click', () => {
    if (document.getElementById('modal-producto').classList.contains('open')) {
      closeAllModals();
      setTimeout(() => startScanner('form'), 300);
    } else {
      startScanner('form');
    }
  });

  document.getElementById('btn-scan-pedido').addEventListener('click', () => startScanner('pedido'));

  // Cleanup scanner on modal close
  document.querySelector('#modal-scanner .modal-overlay').addEventListener('click', stopScanner);
  document.querySelectorAll('#modal-scanner .modal-close, #modal-scanner .modal-close-btn').forEach(el => {
    el.addEventListener('click', stopScanner);
  });

  // ---- BÚSQUEDA DE PRODUCTOS ----
  let searchTerm = '';
  document.getElementById('search-productos').addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderProductos();
  });

  // ---- PRODUCTOS ----
  async function renderProductos() {
    const list = document.getElementById('productos-list');
    list.innerHTML = '<div class="loading">Cargando...</div>';
    try {
      let productos = await DB.productos.getAll();
      if (searchTerm) {
        productos = productos.filter(p =>
          p.nombre.toLowerCase().includes(searchTerm) ||
          (p.categoria || '').toLowerCase().includes(searchTerm)
        );
      }
      if (productos.length === 0) {
        list.innerHTML = '<div class="empty-state">' + (searchTerm ? 'Sin resultados' : 'No hay productos aún.<br><small>Añade tu primer producto</small>') + '</div>';
        return;
      }
      list.innerHTML = productos.map(p => `
        <div class="card" data-id="${p.id}">
          <div class="card-body">
            <div class="card-title">${escapeHtml(p.nombre)}</div>
            <div class="card-meta">${escapeHtml(p.categoria || 'Sin categoría')} · ${escapeHtml(p.unidad || 'ud')}</div>
            ${p.codigo ? `<div class="card-code">📷 ${escapeHtml(p.codigo)}</div>` : ''}
            ${p.precio ? `<div class="card-price">${formatPrice(p.precio)}</div>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-icon edit-producto" data-id="${p.id}" title="Editar">✏️</button>
            <button class="btn-icon del-producto" data-id="${p.id}" title="Eliminar">🗑️</button>
          </div>
        </div>
      `).join('');
      list.querySelectorAll('.edit-producto').forEach(b => b.addEventListener('click', () => editProducto(Number(b.dataset.id))));
      list.querySelectorAll('.del-producto').forEach(b => b.addEventListener('click', () => delProducto(Number(b.dataset.id))));
    } catch (e) {
      list.innerHTML = '<div class="error">Error al cargar productos</div>';
    }
  }

  document.getElementById('btn-add-producto').addEventListener('click', () => {
    document.getElementById('modal-producto-title').textContent = 'Nuevo Producto';
    document.getElementById('producto-id').value = '';
    document.getElementById('producto-nombre').value = '';
    document.getElementById('producto-categoria').value = '';
    document.getElementById('producto-unidad').value = 'ud';
    document.getElementById('producto-precio').value = '';
    document.getElementById('producto-codigo').value = '';
    document.getElementById('modal-producto').classList.add('open');
  });

  document.getElementById('producto-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('producto-id').value;
    const data = {
      nombre: document.getElementById('producto-nombre').value.trim(),
      categoria: document.getElementById('producto-categoria').value.trim(),
      unidad: document.getElementById('producto-unidad').value.trim(),
      precio: parseFloat(document.getElementById('producto-precio').value) || 0,
      codigo: document.getElementById('producto-codigo').value.trim()
    };
    try {
      if (id) { data.id = Number(id); await DB.productos.put(data); showToast('Producto actualizado'); }
      else { await DB.productos.add(data); showToast('Producto creado'); }
      closeAllModals();
      renderProductos();
    } catch (e) { showToast('Error al guardar producto'); }
  });

  async function editProducto(id) {
    try {
      const p = await DB.productos.get(id);
      if (!p) return;
      document.getElementById('modal-producto-title').textContent = 'Editar Producto';
      document.getElementById('producto-id').value = p.id;
      document.getElementById('producto-nombre').value = p.nombre;
      document.getElementById('producto-categoria').value = p.categoria || '';
      document.getElementById('producto-unidad').value = p.unidad || 'ud';
      document.getElementById('producto-precio').value = p.precio || '';
      document.getElementById('producto-codigo').value = p.codigo || '';
      document.getElementById('modal-producto').classList.add('open');
    } catch (e) { showToast('Error al cargar producto'); }
  }

  async function delProducto(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    try { await DB.productos.del(id); showToast('Producto eliminado'); renderProductos(); }
    catch (e) { showToast('Error al eliminar'); }
  }

  // ---- PROVEEDORES ----
  async function renderProveedores() {
    const list = document.getElementById('proveedores-list');
    list.innerHTML = '<div class="loading">Cargando...</div>';
    try {
      const proveedores = await DB.proveedores.getAll();
      if (proveedores.length === 0) {
        list.innerHTML = '<div class="empty-state">No hay proveedores aún.</div>';
        return;
      }
      list.innerHTML = proveedores.map(p => `
        <div class="card" data-id="${p.id}">
          <div class="card-body">
            <div class="card-title">${escapeHtml(p.nombre)}</div>
            <div class="card-meta">📞 ${escapeHtml(p.telefono || 'Sin teléfono')}</div>
            ${p.notas ? `<div class="card-meta">${escapeHtml(p.notas)}</div>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-icon edit-proveedor" data-id="${p.id}" title="Editar">✏️</button>
            <button class="btn-icon del-proveedor" data-id="${p.id}" title="Eliminar">🗑️</button>
          </div>
        </div>
      `).join('');
      list.querySelectorAll('.edit-proveedor').forEach(b => b.addEventListener('click', () => editProveedor(Number(b.dataset.id))));
      list.querySelectorAll('.del-proveedor').forEach(b => b.addEventListener('click', () => delProveedor(Number(b.dataset.id))));
    } catch (e) { list.innerHTML = '<div class="error">Error al cargar proveedores</div>'; }
  }

  document.getElementById('btn-add-proveedor').addEventListener('click', () => {
    document.getElementById('modal-proveedor-title').textContent = 'Nuevo Proveedor';
    document.getElementById('proveedor-id').value = '';
    document.getElementById('proveedor-nombre').value = '';
    document.getElementById('proveedor-telefono').value = '';
    document.getElementById('proveedor-notas').value = '';
    document.getElementById('modal-proveedor').classList.add('open');
  });

  document.getElementById('proveedor-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('proveedor-id').value;
    const data = { nombre: document.getElementById('proveedor-nombre').value.trim(), telefono: document.getElementById('proveedor-telefono').value.trim(), notas: document.getElementById('proveedor-notas').value.trim() };
    try {
      if (id) { data.id = Number(id); await DB.proveedores.put(data); showToast('Proveedor actualizado'); }
      else { await DB.proveedores.add(data); showToast('Proveedor creado'); }
      closeAllModals();
      renderProveedores();
    } catch (e) { showToast('Error al guardar proveedor'); }
  });

  async function editProveedor(id) {
    try {
      const p = await DB.proveedores.get(id);
      if (!p) return;
      document.getElementById('modal-proveedor-title').textContent = 'Editar Proveedor';
      document.getElementById('proveedor-id').value = p.id;
      document.getElementById('proveedor-nombre').value = p.nombre;
      document.getElementById('proveedor-telefono').value = p.telefono || '';
      document.getElementById('proveedor-notas').value = p.notas || '';
      document.getElementById('modal-proveedor').classList.add('open');
    } catch (e) { showToast('Error al cargar proveedor'); }
  }

  async function delProveedor(id) {
    if (!confirm('¿Eliminar este proveedor?')) return;
    try { await DB.proveedores.del(id); showToast('Proveedor eliminado'); renderProveedores(); }
    catch (e) { showToast('Error al eliminar'); }
  }

  // ---- CARGAR SELECTS ----
  async function loadProveedoresSelect(select, selectedId) {
    try {
      const proveedores = await DB.proveedores.getAll();
      select.innerHTML = '<option value="">Sin proveedor</option>' +
        proveedores.map(p => `<option value="${p.id}" ${p.id === Number(selectedId) ? 'selected' : ''}>${escapeHtml(p.nombre)}</option>`).join('');
    } catch (e) { /* ignore */ }
  }

  async function loadProductosSelect(select, selectedId) {
    try {
      const productos = await DB.productos.getAll();
      select.innerHTML = '<option value="">Seleccionar producto...</option>' +
        productos.map(p => `<option value="${p.id}" ${p.id === Number(selectedId) ? 'selected' : ''}>${escapeHtml(p.nombre)} (${escapeHtml(p.unidad || 'ud')})${p.precio ? ' · ' + formatPrice(p.precio) : ''}</option>`).join('');
    } catch (e) { /* ignore */ }
  }

  async function getProductPrice(productoId) {
    try { const p = await DB.productos.get(productoId); return p ? p.precio || 0 : 0; }
    catch (e) { return 0; }
  }

  // ---- LISTAS DE COMPRA ----
  async function renderListas() {
    const list = document.getElementById('listas-list');
    list.innerHTML = '<div class="loading">Cargando...</div>';
    try {
      const [listas, proveedores] = await Promise.all([DB.listas.getAll(), DB.proveedores.getAll()]);
      const provMap = {};
      proveedores.forEach(p => { provMap[p.id] = p.nombre; });
      if (listas.length === 0) {
        list.innerHTML = '<div class="empty-state">No hay listas de compra aún.</div>';
        return;
      }
      list.innerHTML = listas.map(l => {
        const provName = l.proveedorId ? provMap[l.proveedorId] : null;
        const total = (l.items || []).length;
        const checked = (l.items || []).filter(i => i.checked).length;
        return `
          <div class="card" data-id="${l.id}">
            <div class="card-body">
              <div class="card-title">${escapeHtml(l.nombre)}</div>
              <div class="card-meta">${provName ? '🏪 ' + escapeHtml(provName) + ' · ' : ''}${total} producto(s) · ${formatDate(l.creadoEn)}</div>
              <div class="card-meta">✅ ${checked}/${total} comprados</div>
            </div>
            <div class="card-actions">
              <button class="btn-icon check-lista" data-id="${l.id}" title="Comprar">🛒</button>
              <button class="btn-icon edit-lista-btn" data-id="${l.id}" title="Editar">✏️</button>
              <button class="btn-icon create-pedido-from-lista" data-id="${l.id}" title="Crear pedido">📋</button>
              <button class="btn-icon del-lista" data-id="${l.id}" title="Eliminar">🗑️</button>
            </div>
          </div>
        `;
      }).join('');
      list.querySelectorAll('.check-lista').forEach(b => b.addEventListener('click', () => verLista(Number(b.dataset.id))));
      list.querySelectorAll('.edit-lista-btn').forEach(b => b.addEventListener('click', () => editLista(Number(b.dataset.id))));
      list.querySelectorAll('.create-pedido-from-lista').forEach(b => b.addEventListener('click', () => createPedidoFromLista(Number(b.dataset.id))));
      list.querySelectorAll('.del-lista').forEach(b => b.addEventListener('click', () => delLista(Number(b.dataset.id))));
    } catch (e) { list.innerHTML = '<div class="error">Error al cargar listas</div>'; }
  }

  document.getElementById('btn-add-lista').addEventListener('click', () => {
    document.getElementById('modal-lista-title').textContent = 'Nueva Lista de Compra';
    document.getElementById('lista-id').value = '';
    document.getElementById('lista-nombre').value = '';
    document.getElementById('lista-items-container').innerHTML = '';
    loadProveedoresSelect(document.getElementById('lista-proveedor'), null);
    document.getElementById('modal-lista').classList.add('open');
  });

  async function editLista(id) {
    try {
      const l = await DB.listas.get(id);
      if (!l) return;
      document.getElementById('modal-lista-title').textContent = 'Editar Lista';
      document.getElementById('lista-id').value = l.id;
      document.getElementById('lista-nombre').value = l.nombre;
      const container = document.getElementById('lista-items-container');
      container.innerHTML = '';
      await loadProveedoresSelect(document.getElementById('lista-proveedor'), l.proveedorId);
      (l.items || []).forEach(item => addListItemRow(item.productoId, item.cantidad));
      document.getElementById('modal-lista').classList.add('open');
    } catch (e) { showToast('Error al cargar lista'); }
  }

  document.getElementById('btn-add-lista-item').addEventListener('click', () => addListItemRow(null, 1));

  function addListItemRow(productoId, cantidad) {
    const container = document.getElementById('lista-items-container');
    const row = document.createElement('div');
    row.className = 'lista-item-row';
    row.innerHTML = `
      <select class="input lista-item-producto"><option value="">Seleccionar producto...</option></select>
      <input type="number" class="input lista-item-cantidad" value="${cantidad}" min="0.1" step="0.1" style="width:70px">
      <button type="button" class="btn-icon remove-lista-item" title="Quitar">❌</button>
    `;
    container.appendChild(row);
    loadProductosSelect(row.querySelector('select'), productoId);
    row.querySelector('.remove-lista-item').addEventListener('click', () => row.remove());
  }

  document.getElementById('lista-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('lista-id').value;
    const proveedorId = document.getElementById('lista-proveedor').value;
    const rows = document.querySelectorAll('.lista-item-row');
    const items = [];
    let valid = true;
    rows.forEach(row => {
      const prodSelect = row.querySelector('.lista-item-producto');
      const cantidad = parseFloat(row.querySelector('.lista-item-cantidad').value);
      if (prodSelect.value && cantidad > 0) {
        const opt = prodSelect.options[prodSelect.selectedIndex];
        items.push({ productoId: Number(prodSelect.value), productoNombre: opt.text.split(' (')[0], cantidad, unidad: '' });
      } else if (prodSelect.value) { valid = false; }
    });
    if (!valid) { showToast('Revisa las cantidades'); return; }
    const data = { nombre: document.getElementById('lista-nombre').value.trim(), items, proveedorId: proveedorId ? Number(proveedorId) : null };
    try {
      if (id) { data.id = Number(id); await DB.listas.put(data); showToast('Lista actualizada'); }
      else { await DB.listas.add(data); showToast('Lista creada'); }
      closeAllModals();
      renderListas();
    } catch (e) { showToast('Error al guardar lista'); }
  });

  // ---- VER LISTA (check/uncheck) ----
  async function verLista(id) {
    try {
      const [lista, proveedores] = await Promise.all([DB.listas.get(id), DB.proveedores.getAll()]);
      if (!lista) return;
      const provMap = {};
      proveedores.forEach(p => { provMap[p.id] = p.nombre; });
      document.getElementById('ver-lista-title').textContent = '🛒 ' + lista.nombre;
      document.getElementById('ver-lista-proveedor').textContent = lista.proveedorId && provMap[lista.proveedorId] ? '🏪 ' + provMap[lista.proveedorId] : '';
      const container = document.getElementById('ver-lista-items');
      container.innerHTML = (lista.items || []).map((item, idx) => `
        <div class="check-item ${item.checked ? 'checked' : ''}" data-idx="${idx}">
          <div class="check-item-checkbox ${item.checked ? 'checked' : ''}">${item.checked ? '✅' : '⬜'}</div>
          <div class="check-item-info">
            <div class="check-item-name">${escapeHtml(item.productoNombre)}</div>
            <div class="check-item-qty">${item.cantidad} ${item.unidad || 'ud'}</div>
          </div>
        </div>
      `).join('');
      container.querySelectorAll('.check-item').forEach(el => {
        el.addEventListener('click', async () => {
          const idx = Number(el.dataset.idx);
          lista.items[idx].checked = !lista.items[idx].checked;
          await DB.listas.put(lista);
          el.classList.toggle('checked');
          el.querySelector('.check-item-checkbox').classList.toggle('checked');
          el.querySelector('.check-item-checkbox').textContent = lista.items[idx].checked ? '✅' : '⬜';
          renderListas();
        });
      });
      document.getElementById('ver-lista-body').dataset.listaId = id;
      document.getElementById('modal-ver-lista').classList.add('open');
    } catch (e) { showToast('Error al cargar lista'); }
  }

  document.getElementById('btn-uncheck-all').addEventListener('click', async () => {
    const listaId = Number(document.getElementById('ver-lista-body').dataset.listaId);
    if (!listaId) return;
    try {
      const lista = await DB.listas.get(listaId);
      if (!lista) return;
      (lista.items || []).forEach(item => { item.checked = false; });
      await DB.listas.put(lista);
      showToast('Todos desmarcados');
      verLista(listaId);
      renderListas();
    } catch (e) { showToast('Error'); }
  });

  async function delLista(id) {
    if (!confirm('¿Eliminar esta lista?')) return;
    try { await DB.listas.del(id); showToast('Lista eliminada'); renderListas(); }
    catch (e) { showToast('Error al eliminar'); }
  }

  // ---- PEDIDOS ----
  async function renderPedidos() {
    const list = document.getElementById('pedidos-list');
    list.innerHTML = '<div class="loading">Cargando...</div>';
    try {
      let pedidos = await DB.pedidos.getAll();
      if (pedidos.length === 0) { list.innerHTML = '<div class="empty-state">No hay pedidos aún.</div>'; return; }
      pedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      list.innerHTML = pedidos.map(p => {
        const total = (p.items || []).length;
        const entregados = (p.items || []).filter(i => i.cantidadEntregada && i.cantidadEntregada >= i.cantidad).length;
        const totalPrice = (p.items || []).reduce((sum, item) => sum + (item.precioUnitario || 0) * item.cantidad, 0);
        return `
          <div class="card" data-id="${p.id}">
            <div class="card-body">
              <div class="card-title">Pedido #${p.id} · ${escapeHtml(p.proveedorNombre || '—')}</div>
              <div class="card-meta">${formatDate(p.fecha)} · ${getStatusBadge(p.estado)}</div>
              <div class="card-meta">${entregados}/${total} entregados ${totalPrice ? '· Total: ' + formatPrice(totalPrice) : ''}</div>
            </div>
            <div class="card-actions">
              <button class="btn-icon view-pedido" data-id="${p.id}" title="Ver">👁️</button>
              <button class="btn-icon dup-pedido" data-id="${p.id}" title="Duplicar">🔁</button>
              <button class="btn-icon entregar-pedido" data-id="${p.id}" title="Entrega">📦</button>
              <button class="btn-icon whatsapp-pedido" data-id="${p.id}" title="WhatsApp">📱</button>
              <button class="btn-icon del-pedido" data-id="${p.id}" title="Eliminar">🗑️</button>
            </div>
          </div>
        `;
      }).join('');
      list.querySelectorAll('.view-pedido').forEach(b => b.addEventListener('click', () => viewPedido(Number(b.dataset.id))));
      list.querySelectorAll('.dup-pedido').forEach(b => b.addEventListener('click', () => duplicarPedido(Number(b.dataset.id))));
      list.querySelectorAll('.entregar-pedido').forEach(b => b.addEventListener('click', () => entregarPedido(Number(b.dataset.id))));
      list.querySelectorAll('.whatsapp-pedido').forEach(b => b.addEventListener('click', () => whatsappPedido(Number(b.dataset.id))));
      list.querySelectorAll('.del-pedido').forEach(b => b.addEventListener('click', () => delPedido(Number(b.dataset.id))));
    } catch (e) { list.innerHTML = '<div class="error">Error al cargar pedidos</div>'; }
  }

  // Crear pedido desde lista
  async function createPedidoFromLista(listaId) {
    try {
      const [lista, proveedores] = await Promise.all([DB.listas.get(listaId), DB.proveedores.getAll()]);
      if (!lista) { showToast('Lista no encontrada'); return; }
      if (proveedores.length === 0) { showToast('Primero añade un proveedor'); return; }
      document.getElementById('modal-pedido-title').textContent = 'Nuevo Pedido: ' + lista.nombre;
      document.getElementById('pedido-id').value = '';
      document.getElementById('pedido-lista-id').value = listaId;
      const selProv = document.getElementById('pedido-proveedor');
      selProv.innerHTML = '<option value="">Seleccionar proveedor...</option>' +
        proveedores.map(p => `<option value="${p.id}" ${p.id === lista.proveedorId ? 'selected' : ''}>${escapeHtml(p.nombre)}</option>`).join('');
      const container = document.getElementById('pedido-items-container');
      container.innerHTML = '';
      for (const item of (lista.items || [])) {
        const precio = await getProductPrice(item.productoId);
        const row = document.createElement('div');
        row.className = 'pedido-item-row';
        row.innerHTML = `
          <span class="pedido-item-nombre">${escapeHtml(item.productoNombre)}</span>
          <div class="pedido-item-cantidades">
            <label>Pedido: <input type="number" class="input pedido-item-cant" value="${item.cantidad}" min="0.1" step="0.1" style="width:65px"></label>
          </div>
          <input type="hidden" class="pedido-item-prod-id" value="${item.productoId}">
          <input type="hidden" class="pedido-item-prod-nombre" value="${item.productoNombre}">
          <input type="hidden" class="pedido-item-precio" value="${precio}">
        `;
        container.appendChild(row);
      }
      calcPedidoTotal();
      document.getElementById('modal-pedido').classList.add('open');
    } catch (e) { showToast('Error al crear pedido'); }
  }

  // Crear pedido manual
  document.getElementById('btn-add-pedido').addEventListener('click', async () => {
    try {
      const proveedores = await DB.proveedores.getAll();
      if (proveedores.length === 0) { showToast('Primero añade un proveedor'); return; }
      document.getElementById('modal-pedido-title').textContent = 'Nuevo Pedido Manual';
      document.getElementById('pedido-id').value = '';
      document.getElementById('pedido-lista-id').value = '';
      const selProv = document.getElementById('pedido-proveedor');
      selProv.innerHTML = '<option value="">Seleccionar proveedor...</option>' +
        proveedores.map(p => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');
      document.getElementById('pedido-items-container').innerHTML = '';
      document.getElementById('pedido-total-group').style.display = 'none';
      document.getElementById('modal-pedido').classList.add('open');
    } catch (e) { showToast('Error'); }
  });

  document.getElementById('btn-add-pedido-item').addEventListener('click', () => {
    const container = document.getElementById('pedido-items-container');
    const row = document.createElement('div');
    row.className = 'pedido-item-row';
    row.innerHTML = `
      <select class="input pedido-item-select" style="flex:1"><option value="">Seleccionar producto...</option></select>
      <div class="pedido-item-cantidades">
        <label>Pedido: <input type="number" class="input pedido-item-cant" value="1" min="0.1" step="0.1" style="width:65px"></label>
      </div>
      <button type="button" class="btn-icon remove-pedido-item" title="Quitar">❌</button>
    `;
    container.appendChild(row);
    loadProductosSelect(row.querySelector('.pedido-item-select'), null);
    row.querySelector('.pedido-item-select').addEventListener('change', calcPedidoTotal);
    row.querySelector('.pedido-item-cant').addEventListener('input', calcPedidoTotal);
    row.querySelector('.remove-pedido-item').addEventListener('click', () => { row.remove(); calcPedidoTotal(); });
    document.getElementById('pedido-total-group').style.display = 'block';
    calcPedidoTotal();
  });

  async function calcPedidoTotal() {
    const rows = document.querySelectorAll('#pedido-items-container .pedido-item-row');
    let total = 0;
    for (const row of rows) {
      const select = row.querySelector('.pedido-item-select');
      const hiddenId = row.querySelector('.pedido-item-prod-id');
      const cant = parseFloat(row.querySelector('.pedido-item-cant').value) || 0;
      let prodId = null;
      if (select && select.value) prodId = Number(select.value);
      else if (hiddenId) prodId = Number(hiddenId.value);
      if (prodId) {
        const precio = await getProductPrice(prodId);
        total += precio * cant;
      }
    }
    document.getElementById('pedido-total').textContent = formatPrice(total);
    document.getElementById('pedido-total-group').style.display = 'block';
  }

  document.getElementById('pedido-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('pedido-id').value;
    const listaId = document.getElementById('pedido-lista-id').value;
    const proveedorSelect = document.getElementById('pedido-proveedor');
    const proveedorId = Number(proveedorSelect.value);
    const proveedorNombre = proveedorSelect.options[proveedorSelect.selectedIndex]?.text || '';
    if (!proveedorId) { showToast('Selecciona un proveedor'); return; }
    const rows = document.querySelectorAll('#pedido-items-container .pedido-item-row');
    const items = [];
    for (const row of rows) {
      const select = row.querySelector('.pedido-item-select');
      const cantInput = row.querySelector('.pedido-item-cant');
      const hiddenId = row.querySelector('.pedido-item-prod-id');
      const hiddenName = row.querySelector('.pedido-item-prod-nombre');
      const hiddenPrecio = row.querySelector('.pedido-item-precio');
      let prodId, prodNombre, precioUnitario = 0, cantidad;
      if (select) {
        if (!select.value) continue;
        const opt = select.options[select.selectedIndex];
        prodId = Number(select.value);
        prodNombre = opt.text.split(' (')[0];
      } else if (hiddenId) {
        prodId = Number(hiddenId.value);
        prodNombre = hiddenName.value;
        precioUnitario = parseFloat(hiddenPrecio?.value) || 0;
      } else { continue; }
      cantidad = parseFloat(cantInput.value);
      if (cantidad > 0) {
        if (!precioUnitario) precioUnitario = await getProductPrice(prodId);
        items.push({ productoId: prodId, productoNombre: prodNombre, cantidad, cantidadEntregada: 0, precioUnitario, unidad: '' });
      }
    }
    if (items.length === 0) { showToast('Añade al menos un producto'); return; }
    const data = { proveedorId, proveedorNombre, listaId: listaId ? Number(listaId) : null, items, estado: 'pendiente' };
    try {
      if (id) { data.id = Number(id); await DB.pedidos.put(data); showToast('Pedido actualizado'); }
      else { await DB.pedidos.add(data); showToast('Pedido creado'); }
      closeAllModals();
      renderPedidos();
    } catch (e) { showToast('Error al guardar pedido'); }
  });

  // ---- DUPLICAR PEDIDO ----
  async function duplicarPedido(id) {
    try {
      const p = await DB.pedidos.get(id);
      if (!p) return;
      document.getElementById('modal-pedido-title').textContent = 'Duplicar Pedido #' + p.id;
      document.getElementById('pedido-id').value = '';
      document.getElementById('pedido-lista-id').value = p.listaId || '';
      const selProv = document.getElementById('pedido-proveedor');
      const proveedores = await DB.proveedores.getAll();
      selProv.innerHTML = '<option value="">Seleccionar proveedor...</option>' +
        proveedores.map(pr => `<option value="${pr.id}" ${pr.id === p.proveedorId ? 'selected' : ''}>${escapeHtml(pr.nombre)}</option>`).join('');
      const container = document.getElementById('pedido-items-container');
      container.innerHTML = '';
      for (const item of (p.items || [])) {
        const row = document.createElement('div');
        row.className = 'pedido-item-row';
        row.innerHTML = `
          <span class="pedido-item-nombre">${escapeHtml(item.productoNombre)}</span>
          <div class="pedido-item-cantidades">
            <label>Pedido: <input type="number" class="input pedido-item-cant" value="${item.cantidad}" min="0.1" step="0.1" style="width:65px"></label>
          </div>
          <input type="hidden" class="pedido-item-prod-id" value="${item.productoId}">
          <input type="hidden" class="pedido-item-prod-nombre" value="${item.productoNombre}">
          <input type="hidden" class="pedido-item-precio" value="${item.precioUnitario || 0}">
        `;
        container.appendChild(row);
      }
      calcPedidoTotal();
      document.getElementById('modal-pedido').classList.add('open');
    } catch (e) { showToast('Error al duplicar pedido'); }
  }

  // ---- VER PEDIDO ----
  async function viewPedido(id) {
    try {
      const p = await DB.pedidos.get(id);
      if (!p) return;
      const totalPrice = (p.items || []).reduce((sum, item) => sum + (item.precioUnitario || 0) * item.cantidad, 0);
      let msg = `📋 *PEDIDO #${p.id}*\n`;
      msg += `🏪 Proveedor: ${p.proveedorNombre || '—'}\n`;
      msg += `📅 Fecha: ${formatDate(p.fecha)}\n`;
      msg += `📌 Estado: ${p.estado}\n`;
      if (totalPrice) msg += `💰 Total: ${formatPrice(totalPrice)}\n`;
      msg += `\n*Productos:*\n`;
      (p.items || []).forEach(item => {
        const entregado = item.cantidadEntregada || 0;
        const icon = entregado >= item.cantidad ? '✅' : (entregado > 0 ? '🟡' : '⬜');
        const price = item.precioUnitario ? ` (${formatPrice(item.precioUnitario)} c/u)` : '';
        msg += `${icon} ${item.productoNombre}: pedido ${item.cantidad}, entregado ${entregado}${price}\n`;
      });
      alert(msg);
    } catch (e) { showToast('Error al cargar pedido'); }
  }

  // ---- ENTREGAR PEDIDO ----
  async function entregarPedido(id) {
    try {
      const p = await DB.pedidos.get(id);
      if (!p) return;
      document.getElementById('modal-entrega-title').textContent = 'Registrar Entrega - Pedido #' + p.id;
      document.getElementById('entrega-pedido-id').value = p.id;
      document.getElementById('entrega-items-container').innerHTML = (p.items || []).map((item, idx) => `
        <div class="entrega-item-row">
          <div class="entrega-item-info">
            <strong>${escapeHtml(item.productoNombre)}</strong><br>
            <small>Pedido: ${item.cantidad} · Entregado antes: ${item.cantidadEntregada || 0}</small>
          </div>
          <input type="number" class="input entrega-item-cant" value="${item.cantidad}" min="0" max="${item.cantidad}" step="0.1" style="width:80px" data-idx="${idx}">
          <input type="hidden" class="entrega-item-idx" value="${idx}">
        </div>
      `).join('');
      document.getElementById('modal-entrega').classList.add('open');
    } catch (e) { showToast('Error al cargar pedido'); }
  }

  document.getElementById('entrega-form').addEventListener('submit', async e => {
    e.preventDefault();
    const pedidoId = Number(document.getElementById('entrega-pedido-id').value);
    try {
      const p = await DB.pedidos.get(pedidoId);
      if (!p) return;
      document.querySelectorAll('#entrega-items-container .entrega-item-row').forEach(row => {
        const idx = Number(row.querySelector('.entrega-item-idx').value);
        const cant = parseFloat(row.querySelector('.entrega-item-cant').value) || 0;
        if (p.items[idx]) p.items[idx].cantidadEntregada = cant;
      });
      const allDelivered = p.items.every(item => (item.cantidadEntregada || 0) >= item.cantidad);
      const someDelivered = p.items.some(item => (item.cantidadEntregada || 0) > 0);
      p.estado = allDelivered ? 'completado' : (someDelivered ? 'parcial' : 'pendiente');
      await DB.pedidos.put(p);
      closeAllModals();
      showToast('Entrega registrada');
      renderPedidos();
    } catch (e) { showToast('Error al guardar entrega'); }
  });

  // ---- WHATSAPP ----
  async function whatsappPedido(id) {
    try {
      const p = await DB.pedidos.get(id);
      if (!p) return;
      const proveedor = await DB.proveedores.get(p.proveedorId);
      let telefono = proveedor ? proveedor.telefono : '';
      if (!telefono) {
        telefono = prompt('Teléfono del proveedor (con código de país, ej: 521234567890):');
        if (!telefono) return;
      }
      const totalPrice = (p.items || []).reduce((sum, item) => sum + (item.precioUnitario || 0) * item.cantidad, 0);
      let msg = `📋 *PEDIDO #${p.id}*\n`;
      msg += `🏪 Proveedor: ${p.proveedorNombre || '—'}\n`;
      msg += `📅 Fecha: ${formatDate(p.fecha)}\n`;
      msg += `📌 Estado: ${p.estado}\n`;
      if (totalPrice) msg += `💰 Total: ${formatPrice(totalPrice)}\n`;
      msg += `\n*PRODUCTOS:*\n`;
      (p.items || []).forEach(item => {
        const entregado = item.cantidadEntregada || 0;
        const check = entregado >= item.cantidad ? '✅' : '';
        const price = item.precioUnitario ? ` · ${formatPrice(item.precioUnitario)}` : '';
        msg += `• ${item.productoNombre}: ${item.cantidad} ${item.unidad || 'ud'}${price} ${check}\n`;
      });
      msg += `\nTotal productos: ${(p.items || []).length}`;
      window.location.href = `https://wa.me/${telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
    } catch (e) { showToast('Error al enviar WhatsApp'); }
  }

  async function delPedido(id) {
    if (!confirm('¿Eliminar este pedido?')) return;
    try { await DB.pedidos.del(id); showToast('Pedido eliminado'); renderPedidos(); }
    catch (e) { showToast('Error al eliminar'); }
  }

  // ---- DASHBOARD ----
  async function renderDashboard() {
    try {
      const [productos, proveedores, listas, pedidos] = await Promise.all([
        DB.productos.getAll(), DB.proveedores.getAll(), DB.listas.getAll(), DB.pedidos.getAll()
      ]);
      document.getElementById('dashboard-productos').textContent = productos.length;
      document.getElementById('dashboard-proveedores').textContent = proveedores.length;
      document.getElementById('dashboard-listas').textContent = listas.length;
      document.getElementById('dashboard-pedidos').textContent = pedidos.length;
      document.getElementById('dashboard-pendientes').textContent = pedidos.filter(p => p.estado === 'pendiente' || p.estado === 'parcial').length;
      const recentList = document.getElementById('dashboard-recent');
      const recent = pedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);
      if (recent.length === 0) recentList.innerHTML = '<div class="empty-state">No hay pedidos recientes</div>';
      else recentList.innerHTML = recent.map(p =>
        `<div class="recent-item"><span>#${p.id} ${escapeHtml(p.proveedorNombre || '—')}</span>${getStatusBadge(p.estado)}</div>`
      ).join('');
    } catch (e) { /* ignore */ }
  }

  // ---- MODAL CLOSE ----
  document.querySelectorAll('.modal-close, .modal-overlay, .modal-close-btn').forEach(el => {
    el.addEventListener('click', closeAllModals);
  });

  // ---- INICIO ----
  document.addEventListener('DOMContentLoaded', async () => {
    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('./sw.js'); }
      catch (e) { /* sw not supported */ }
    }
    await Promise.all([renderDashboard(), renderProductos(), renderProveedores(), renderListas(), renderPedidos()]);
    showSection('inicio');
  });

})();
