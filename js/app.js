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
    if (id === 'pedidos') renderPedidos();
    if (id === 'proveedores') renderProveedores();
    if (id === 'dashboard') renderDashboard();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => showSection(item.dataset.section));
  });

  // ---- UTILIDADES ----
  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text || '';
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
    if (!toast) return;
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

  // Normalizador de texto para ignorar tildes/acentos
  function normalizeText(text) {
    return (text || '')
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  // ---- MODO OSCURO ----
  const darkToggle = document.getElementById('dark-toggle');
  let darkMode = localStorage.getItem('darkMode') === 'true';

  function applyDark(enable) {
    document.body.classList.toggle('dark', enable);
    if (darkToggle) darkToggle.textContent = enable ? '☀️' : '🌙';
    localStorage.setItem('darkMode', enable);
  }
  if (darkToggle) {
    darkToggle.addEventListener('click', () => { darkMode = !darkMode; applyDark(darkMode); });
  }
  applyDark(darkMode);

  // ---- EXPORTAR / IMPORTAR / LIMPIAR ----
  const btnExportar = document.getElementById('btn-exportar');
  if (btnExportar) {
    btnExportar.addEventListener('click', async () => {
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
  }

  const btnImportar = document.getElementById('btn-importar');
  if (btnImportar) {
    btnImportar.addEventListener('click', () => {
      document.getElementById('import-file').click();
    });
  }

  const importFile = document.getElementById('import-file');
  if (importFile) {
    importFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.productos || !data.proveedores || !data.listas || !data.pedidos) {
          showToast('Archivo no válido'); return;
        }
        if (!confirm('¿Importar datos? Se añadirán a los existentes.')) return;
        for (const p of data.productos) await DB.productos.add({ nombre: p.nombre, categoria: p.categoria || '', unidad: p.unidad || 'ud', precio: p.precio || 0, codigo: p.codigo || '' });
        for (const p of data.proveedores) await DB.proveedores.add({ nombre: p.nombre, telefono: p.telefono || '', notas: p.notas || '' });
        for (const l of data.listas) await DB.listas.add({ nombre: l.nombre, items: l.items || [], proveedorId: l.proveedorId || null, creadoEn: l.creadoEn || new Date().toISOString() });
        for (const p of data.pedidos) await DB.pedidos.add({ proveedorId: p.proveedorId, proveedorNombre: p.proveedorNombre, items: p.items || [], estado: p.estado || 'pendiente', fecha: p.fecha || new Date().toISOString() });
        showToast('Datos importados');
        renderDashboard(); renderProductos(); renderProveedores(); renderListas(); renderPedidos();
      } catch (e) { showToast('Error al importar'); }
      e.target.value = '';
    });
  }

  const btnLimpiar = document.getElementById('btn-limpiar');
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', async () => {
      if (!confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
      if (!confirm('¿Estás seguro? Se eliminarán productos, proveedores, listas y pedidos.')) return;
      try {
        await Promise.all([DB.productos.clear(), DB.proveedores.clear(), DB.listas.clear(), DB.pedidos.clear()]);
        showToast('Todos los datos eliminados');
        renderDashboard(); renderProductos(); renderProveedores(); renderListas(); renderPedidos();
      } catch (e) { showToast('Error al limpiar'); }
    });
  }

  // ---- BÚSQUEDA DE PRODUCTOS ----
  let searchTerm = '';
  const searchInput = document.getElementById('search-productos');
  const btnClearSearch = document.getElementById('btn-clear-search'); // Si tienes botón para limpiar campo

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = normalizeText(e.target.value);
      renderProductos();
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchTerm = '';
        renderProductos();
      }
    });
  }

  // ---- PRODUCTOS ----
  async function renderProductos() {
    const list = document.getElementById('productos-list');
    if (!list) return;
    list.innerHTML = '<div class="loading">Cargando...</div>';
    try {
      let productos = await DB.productos.getAll();
      productos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
      
      // Filtrado interactivo por Nombre, Categoría o Código
      if (searchTerm) {
        productos = productos.filter(p => {
          const nom = normalizeText(p.nombre);
          const cat = normalizeText(p.categoria);
          const cod = normalizeText(p.codigo);
          return nom.includes(searchTerm) || cat.includes(searchTerm) || cod.includes(searchTerm);
        });
      }

      if (productos.length === 0) {
        list.innerHTML = '<div class="empty-state">' + (searchTerm ? '🔍 No se encontraron productos que coincidan con la búsqueda' : 'No hay productos aún.<br><small>Añade tu primer producto</small>') + '</div>';
        return;
      }

      list.innerHTML = productos.map(p => `
        <div class="card" data-id="${p.id}">
          <div class="card-body">
            <div class="card-title">${escapeHtml(p.nombre)}</div>
            <div class="card-meta">${escapeHtml(p.categoria || 'Sin categoría')} · ${escapeHtml(p.unidad || 'ud')}</div>
            ${p.codigo ? `<div class="card-code">${escapeHtml(p.codigo)}</div>` : ''}
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

  const btnAddProducto = document.getElementById('btn-add-producto');
  if (btnAddProducto) {
    btnAddProducto.addEventListener('click', () => {
      document.getElementById('modal-producto-title').textContent = 'Nuevo Producto';
      document.getElementById('producto-id').value = '';
      document.getElementById('producto-nombre').value = '';
      document.getElementById('producto-categoria').value = '';
      document.getElementById('producto-unidad').value = 'ud';
      document.getElementById('producto-precio').value = '';
      document.getElementById('producto-codigo').value = '';
      document.getElementById('modal-producto').classList.add('open');
    });
  }

  const productoForm = document.getElementById('producto-form');
  if (productoForm) {
    productoForm.addEventListener('submit', async e => {
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
  }

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
    if (!list) return;
    list.innerHTML = '<div class="loading">Cargando...</div>';
    try {
      const proveedores = await DB.proveedores.getAll();
      proveedores.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
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

  const btnAddProveedor = document.getElementById('btn-add-proveedor');
  if (btnAddProveedor) {
    btnAddProveedor.addEventListener('click', () => {
      document.getElementById('modal-proveedor-title').textContent = 'Nuevo Proveedor';
      document.getElementById('proveedor-id').value = '';
      document.getElementById('proveedor-nombre').value = '';
      document.getElementById('proveedor-telefono').value = '';
      document.getElementById('proveedor-notas').value = '';
      document.getElementById('modal-proveedor').classList.add('open');
    });
  }

  const proveedorForm = document.getElementById('proveedor-form');
  if (proveedorForm) {
    proveedorForm.addEventListener('submit', async e => {
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
  }

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
    if (!select) return;
    try {
      const proveedores = await DB.proveedores.getAll();
      proveedores.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
      select.innerHTML = '<option value="">Sin proveedor</option>' +
        proveedores.map(p => `<option value="${p.id}" ${p.id === Number(selectedId) ? 'selected' : ''}>${escapeHtml(p.nombre)}</option>`).join('');
    } catch (e) { /* ignore */ }
  }

  async function loadProductosSelect(select, selectedId) {
    if (!select) return;
    try {
      const productos = await DB.productos.getAll();
      productos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
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
    if (!list) return;
    list.innerHTML = '<div class="loading">Cargando...</div>';
    try {
      const [listas, proveedores] = await Promise.all([DB.listas.getAll(), DB.proveedores.getAll()]);
      listas.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
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

  const btnAddLista = document.getElementById('btn-add-lista');
  if (btnAddLista) {
    btnAddLista.addEventListener('click', () => {
      document.getElementById('modal-lista-title').textContent = 'Nueva Lista de Compra';
      document.getElementById('lista-id').value = '';
      document.getElementById('lista-nombre').value = '';
      document.getElementById('lista-items-container').innerHTML = '';
      loadProveedoresSelect(document.getElementById('lista-proveedor'), null);
      document.getElementById('modal-lista').classList.add('open');
    });
  }

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

  const btnAddListaItem = document.getElementById('btn-add-lista-item');
  if (btnAddListaItem) {
    btnAddListaItem.addEventListener('click', () => addListItemRow(null, 1));
  }

  function addListItemRow(productoId, cantidad) {
    const container = document.getElementById('lista-items-container');
    if (!container) return;
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

  const listaForm = document.getElementById('lista-form');
  if (listaForm) {
    listaForm.addEventListener('submit', async e => {
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
      items.sort((a, b) => (a.productoNombre || '').localeCompare(b.productoNombre || '', 'es', { sensitivity: 'base' }));
      const data = { nombre: document.getElementById('lista-nombre').value.trim(), items, proveedorId: proveedorId ? Number(proveedorId) : null, creadoEn: new Date().toISOString() };
      try {
        if (id) { data.id = Number(id); await DB.listas.put(data); showToast('Lista actualizada'); }
        else { await DB.listas.add(data); showToast('Lista creada'); }
        closeAllModals();
        renderListas();
      } catch (e) { showToast('Error al guardar lista'); }
    });
  }

  // ---- VER LISTA (check/uncheck) ----
  async function verLista(id) {
    try {
      const [lista, proveedores] = await Promise.all([DB.listas.get(id), DB.proveedores.getAll()]);
      if (!lista) return;
      const provMap = {};
      proveedores.forEach(p => { provMap[p.id] = p.nombre; });
      document.getElementById('ver-lista-title').textContent = '🛒 ' + lista.nombre;
      document.getElementById('ver-lista-proveedor').textContent = lista.proveedorId && provMap[lista.proveedorId] ? '🏪 ' + provMap[lista.proveedorId] : '';
      
      if (lista.items) {
        lista.items.sort((a, b) => (a.productoNombre || '').localeCompare(b.productoNombre || '', 'es', { sensitivity: 'base' }));
      }

      for (const item of (lista.items || [])) {
        if (item.precioUnitario === undefined) {
          item.precioUnitario = await getProductPrice(item.productoId);
        }
      }

      function updateVerListaUI() {
        const container = document.getElementById('ver-lista-items');
        if (!container) return;
        let totalPendiente = 0;
        
        container.innerHTML = (lista.items || []).map((item, idx) => {
          const itemTotal = (item.precioUnitario || 0) * (item.cantidad || 0);
          if (!item.checked) totalPendiente += itemTotal;
          
          return `
            <div class="check-item ${item.checked ? 'checked' : ''}" data-idx="${idx}">
              <div class="check-item-checkbox ${item.checked ? 'checked' : ''}">${item.checked ? '✅' : '⬜'}</div>
              <div class="check-item-info">
                <div style="display:flex;justify-content:space-between">
                  <div class="check-item-name">${escapeHtml(item.productoNombre)}</div>
                  <div class="check-item-price" style="font-weight:600;color:var(--blue)">${formatPrice(itemTotal)}</div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--text-secondary)">
                  <div class="check-item-qty" style="display:flex;align-items:center;gap:4px">
                    <button class="btn-qty-minus" data-idx="${idx}" style="border:1px solid var(--gray-300);background:var(--surface);border-radius:4px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text)">-</button>
                    <input type="number" class="input-qty" data-idx="${idx}" value="${item.cantidad}" min="0.1" step="0.1" style="width:50px;text-align:center;padding:2px;font-size:12px;height:24px">
                    <button class="btn-qty-plus" data-idx="${idx}" style="border:1px solid var(--gray-300);background:var(--surface);border-radius:4px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text)">+</button>
                    <span>${item.unidad || 'ud'}</span>
                  </div>
                  <div class="check-item-unit-price">${formatPrice(item.precioUnitario)}/ud</div>
                </div>
              </div>
            </div>
          `;
        }).join('');

        const totalEl = document.getElementById('ver-lista-total');
        if (totalEl) totalEl.textContent = formatPrice(totalPendiente);

        container.querySelectorAll('.check-item-checkbox').forEach(el => {
          el.onclick = async (e) => {
            e.stopPropagation();
            const idx = Number(el.closest('.check-item').dataset.idx);
            lista.items[idx].checked = !lista.items[idx].checked;
            await DB.listas.put(lista);
            updateVerListaUI();
            renderListas();
          };
        });

        container.querySelectorAll('.btn-qty-minus').forEach(btn => {
          btn.onclick = async (e) => {
            e.stopPropagation();
            const idx = Number(btn.dataset.idx);
            if (lista.items[idx].cantidad > 0.1) {
              lista.items[idx].cantidad = Math.max(0.1, Number((lista.items[idx].cantidad - 1).toFixed(1)));
              await DB.listas.put(lista);
              updateVerListaUI();
            }
          };
        });

        container.querySelectorAll('.btn-qty-plus').forEach(btn => {
          btn.onclick = async (e) => {
            e.stopPropagation();
            const idx = Number(btn.dataset.idx);
            lista.items[idx].cantidad = Number((lista.items[idx].cantidad + 1).toFixed(1));
            await DB.listas.put(lista);
            updateVerListaUI();
          };
        });

        container.querySelectorAll('.input-qty').forEach(input => {
          input.onclick = (e) => e.stopPropagation();
          input.onchange = async () => {
            const idx = Number(input.dataset.idx);
            const newVal = parseFloat(input.value);
            if (newVal > 0) {
              lista.items[idx].cantidad = newVal;
              await DB.listas.put(lista);
              updateVerListaUI();
            }
          };
        });
      }

      updateVerListaUI();
      document.getElementById('ver-lista-body').dataset.listaId = id;
      document.getElementById('modal-ver-lista').classList.add('open');
    } catch (e) { console.error(e); showToast('Error al cargar lista'); }
  }

  const btnCheckAll = document.getElementById('btn-check-all');
  if (btnCheckAll) {
    btnCheckAll.addEventListener('click', async () => {
      const listaId = Number(document.getElementById('ver-lista-body').dataset.listaId);
      if (!listaId) return;
      try {
        const lista = await DB.listas.get(listaId);
        if (!lista) return;
        (lista.items || []).forEach(item => { item.checked = true; });
        await DB.listas.put(lista);
        showToast('Todos marcados como comprados');
        verLista(listaId);
        renderListas();
      } catch (e) { showToast('Error'); }
    });
  }

  const btnUncheckAll = document.getElementById('btn-uncheck-all');
  if (btnUncheckAll) {
    btnUncheckAll.addEventListener('click', async () => {
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
  }

  async function delLista(id) {
    if (!confirm('¿Eliminar esta lista?')) return;
    try { await DB.listas.del(id); showToast('Lista eliminada'); renderListas(); }
    catch (e) { showToast('Error al eliminar'); }
  }

  // ---- PEDIDOS ----
  async function renderPedidos() {
    const list = document.getElementById('pedidos-list');
    if (!list) return;
    list.innerHTML = '<div class="loading">Cargando...</div>';
    try {
      let pedidos = await DB.pedidos.getAll();
      if (pedidos.length === 0) { list.innerHTML = '<div class="empty-state">No hay pedidos aún.</div>'; return; }
      pedidos.sort((a, b) => (a.proveedorNombre || '').localeCompare(b.proveedorNombre || '', 'es', { sensitivity: 'base' }) || new Date(b.fecha) - new Date(a.fecha));
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
      proveedores.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
      document.getElementById('modal-pedido-title').textContent = 'Nuevo Pedido: ' + lista.nombre;
      document.getElementById('pedido-id').value = '';
      document.getElementById('pedido-lista-id').value = listaId;
      const selProv = document.getElementById('pedido-proveedor');
      selProv.innerHTML = '<option value="">Seleccionar proveedor...</option>' +
        proveedores.map(p => `<option value="${p.id}" ${p.id === lista.proveedorId ? 'selected' : ''}>${escapeHtml(p.nombre)}</option>`).join('');
      const container = document.getElementById('pedido-items-container');
      container.innerHTML = '';
      const items = (lista.items || []).slice().sort((a, b) => (a.productoNombre || '').localeCompare(b.productoNombre || '', 'es', { sensitivity: 'base' }));
      for (const item of items) {
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

  function calcPedidoTotal() {
    let total = 0;
    document.querySelectorAll('.pedido-item-row').forEach(row => {
      const cant = parseFloat(row.querySelector('.pedido-item-cant').value) || 0;
      const precio = parseFloat(row.querySelector('.pedido-item-precio').value) || 0;
      total += cant * precio;
    });
    const totalEl = document.getElementById('pedido-total');
    if (totalEl) totalEl.textContent = formatPrice(total);
  }

  // Cierre modal global
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  // Inicialización
  renderDashboard();
  renderProductos();
})();

})();
