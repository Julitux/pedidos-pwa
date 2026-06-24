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

  // ---- PRODUCTOS ----
  async function renderProductos() {
    const list = document.getElementById('productos-list');
    list.innerHTML = '<div class="loading">Cargando...</div>';
    try {
      const productos = await DB.productos.getAll();
      if (productos.length === 0) {
        list.innerHTML = '<div class="empty-state">No hay productos aún.<br><small>Añade tu primer producto</small></div>';
        return;
      }
      list.innerHTML = productos.map(p => `
        <div class="card" data-id="${p.id}">
          <div class="card-body">
            <div class="card-title">${escapeHtml(p.nombre)}</div>
            <div class="card-meta">${escapeHtml(p.categoria || 'Sin categoría')} · ${escapeHtml(p.unidad || 'ud')}</div>
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
    document.getElementById('modal-producto').classList.add('open');
  });

  document.getElementById('producto-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('producto-id').value;
    const data = {
      nombre: document.getElementById('producto-nombre').value.trim(),
      categoria: document.getElementById('producto-categoria').value.trim(),
      unidad: document.getElementById('producto-unidad').value.trim()
    };
    try {
      if (id) {
        data.id = Number(id);
        await DB.productos.put(data);
        showToast('Producto actualizado');
      } else {
        await DB.productos.add(data);
        showToast('Producto creado');
      }
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
      document.getElementById('modal-producto').classList.add('open');
    } catch (e) { showToast('Error al cargar producto'); }
  }

  async function delProducto(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await DB.productos.del(id);
      showToast('Producto eliminado');
      renderProductos();
    } catch (e) { showToast('Error al eliminar'); }
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
    } catch (e) {
      list.innerHTML = '<div class="error">Error al cargar proveedores</div>';
    }
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
    const data = {
      nombre: document.getElementById('proveedor-nombre').value.trim(),
      telefono: document.getElementById('proveedor-telefono').value.trim(),
      notas: document.getElementById('proveedor-notas').value.trim()
    };
    try {
      if (id) {
        data.id = Number(id);
        await DB.proveedores.put(data);
        showToast('Proveedor actualizado');
      } else {
        await DB.proveedores.add(data);
        showToast('Proveedor creado');
      }
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
    try {
      await DB.proveedores.del(id);
      showToast('Proveedor eliminado');
      renderProveedores();
    } catch (e) { showToast('Error al eliminar'); }
  }

  // ---- LISTAS DE COMPRA ----
  async function renderListas() {
    const list = document.getElementById('listas-list');
    list.innerHTML = '<div class="loading">Cargando...</div>';
    try {
      const listas = await DB.listas.getAll();
      if (listas.length === 0) {
        list.innerHTML = '<div class="empty-state">No hay listas de compra aún.</div>';
        return;
      }
      list.innerHTML = listas.map(l => `
        <div class="card" data-id="${l.id}">
          <div class="card-body">
            <div class="card-title">${escapeHtml(l.nombre)}</div>
            <div class="card-meta">${(l.items || []).length} producto(s) · ${formatDate(l.creadoEn)}</div>
          </div>
          <div class="card-actions">
            <button class="btn-icon view-lista" data-id="${l.id}" title="Ver">👁️</button>
            <button class="btn-icon create-pedido-from-lista" data-id="${l.id}" title="Crear pedido">📋</button>
            <button class="btn-icon del-lista" data-id="${l.id}" title="Eliminar">🗑️</button>
          </div>
        </div>
      `).join('');
      list.querySelectorAll('.view-lista').forEach(b => b.addEventListener('click', () => viewLista(Number(b.dataset.id))));
      list.querySelectorAll('.create-pedido-from-lista').forEach(b => b.addEventListener('click', () => createPedidoFromLista(Number(b.dataset.id))));
      list.querySelectorAll('.del-lista').forEach(b => b.addEventListener('click', () => delLista(Number(b.dataset.id))));
    } catch (e) {
      list.innerHTML = '<div class="error">Error al cargar listas</div>';
    }
  }

  document.getElementById('btn-add-lista').addEventListener('click', () => {
    document.getElementById('modal-lista-title').textContent = 'Nueva Lista de Compra';
    document.getElementById('lista-id').value = '';
    document.getElementById('lista-nombre').value = '';
    document.getElementById('lista-items-container').innerHTML = '';
    document.getElementById('modal-lista').classList.add('open');
  });

  document.getElementById('btn-add-lista-item').addEventListener('click', () => {
    addListItemRow(null, 1);
  });

  function addListItemRow(productoId, cantidad) {
    const container = document.getElementById('lista-items-container');
    const idx = container.children.length;
    const row = document.createElement('div');
    row.className = 'lista-item-row';
    row.innerHTML = `
      <select class="input lista-item-producto" data-idx="${idx}">
        <option value="">Seleccionar producto...</option>
      </select>
      <input type="number" class="input lista-item-cantidad" value="${cantidad}" min="0.1" step="0.1" style="width:70px">
      <button type="button" class="btn-icon remove-lista-item" title="Quitar">❌</button>
    `;
    container.appendChild(row);
    loadProductosSelect(row.querySelector('select'), productoId);
    row.querySelector('.remove-lista-item').addEventListener('click', () => row.remove());
  }

  async function loadProductosSelect(select, selectedId) {
    try {
      const productos = await DB.productos.getAll();
      select.innerHTML = '<option value="">Seleccionar producto...</option>' +
        productos.map(p => `<option value="${p.id}" ${p.id === Number(selectedId) ? 'selected' : ''}>${escapeHtml(p.nombre)} (${escapeHtml(p.unidad || 'ud')})</option>`).join('');
    } catch (e) { /* ignore */ }
  }

  document.getElementById('lista-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('lista-id').value;
    const rows = document.querySelectorAll('.lista-item-row');
    const items = [];
    let valid = true;
    rows.forEach(row => {
      const prodSelect = row.querySelector('.lista-item-producto');
      const cantidad = parseFloat(row.querySelector('.lista-item-cantidad').value);
      if (prodSelect.value && cantidad > 0) {
        const opt = prodSelect.options[prodSelect.selectedIndex];
        items.push({
          productoId: Number(prodSelect.value),
          productoNombre: opt.text.split(' (')[0],
          cantidad: cantidad,
          unidad: ''
        });
      } else if (prodSelect.value) {
        valid = false;
      }
    });
    if (!valid) { showToast('Revisa las cantidades'); return; }
    const data = {
      nombre: document.getElementById('lista-nombre').value.trim(),
      items: items
    };
    try {
      if (id) {
        data.id = Number(id);
        await DB.listas.put(data);
        showToast('Lista actualizada');
      } else {
        await DB.listas.add(data);
        showToast('Lista creada');
      }
      closeAllModals();
      renderListas();
    } catch (e) { showToast('Error al guardar lista'); }
  });

  async function viewLista(id) {
    try {
      const lista = await DB.listas.get(id);
      if (!lista) return;
      let msg = `📋 *${lista.nombre}*\n`;
      msg += `📅 ${formatDate(lista.creadoEn)}\n\n*Productos:*\n`;
      (lista.items || []).forEach(item => {
        msg += `- ${item.productoNombre} x ${item.cantidad}\n`;
      });
      alert(msg);
    } catch (e) { showToast('Error al cargar lista'); }
  }

  async function delLista(id) {
    if (!confirm('¿Eliminar esta lista?')) return;
    try {
      await DB.listas.del(id);
      showToast('Lista eliminada');
      renderListas();
    } catch (e) { showToast('Error al eliminar'); }
  }

  // ---- PEDIDOS ----
  async function renderPedidos() {
    const list = document.getElementById('pedidos-list');
    list.innerHTML = '<div class="loading">Cargando...</div>';
    try {
      const pedidos = await DB.pedidos.getAll();
      if (pedidos.length === 0) {
        list.innerHTML = '<div class="empty-state">No hay pedidos aún.</div>';
        return;
      }
      pedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      list.innerHTML = pedidos.map(p => {
        const total = (p.items || []).length;
        const entregados = (p.items || []).filter(i => i.cantidadEntregada && i.cantidadEntregada >= i.cantidad).length;
        return `
          <div class="card" data-id="${p.id}">
            <div class="card-body">
              <div class="card-title">Pedido #${p.id} · ${escapeHtml(p.proveedorNombre || '—')}</div>
              <div class="card-meta">${formatDate(p.fecha)} · ${getStatusBadge(p.estado)}</div>
              <div class="card-meta">${entregados}/${total} productos entregados</div>
            </div>
            <div class="card-actions">
              <button class="btn-icon view-pedido" data-id="${p.id}" title="Ver detalle">👁️</button>
              <button class="btn-icon entregar-pedido" data-id="${p.id}" title="Registrar entrega">📦</button>
              <button class="btn-icon whatsapp-pedido" data-id="${p.id}" title="Enviar por WhatsApp">📱</button>
              <button class="btn-icon del-pedido" data-id="${p.id}" title="Eliminar">🗑️</button>
            </div>
          </div>
        `;
      }).join('');
      list.querySelectorAll('.view-pedido').forEach(b => b.addEventListener('click', () => viewPedido(Number(b.dataset.id))));
      list.querySelectorAll('.entregar-pedido').forEach(b => b.addEventListener('click', () => entregarPedido(Number(b.dataset.id))));
      list.querySelectorAll('.whatsapp-pedido').forEach(b => b.addEventListener('click', () => whatsappPedido(Number(b.dataset.id))));
      list.querySelectorAll('.del-pedido').forEach(b => b.addEventListener('click', () => delPedido(Number(b.dataset.id))));
    } catch (e) {
      list.innerHTML = '<div class="error">Error al cargar pedidos</div>';
    }
  }

  // Crear pedido desde lista
  async function createPedidoFromLista(listaId) {
    try {
      const [lista, proveedores] = await Promise.all([DB.listas.get(listaId), DB.proveedores.getAll()]);
      if (!lista) { showToast('Lista no encontrada'); return; }
      if (proveedores.length === 0) { showToast('Primero añade un proveedor'); return; }

      document.getElementById('modal-pedido-title').textContent = `Nuevo Pedido: ${lista.nombre}`;
      document.getElementById('pedido-id').value = '';
      document.getElementById('pedido-lista-id').value = listaId;

      const selProv = document.getElementById('pedido-proveedor');
      selProv.innerHTML = '<option value="">Seleccionar proveedor...</option>' +
        proveedores.map(p => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join('');

      const container = document.getElementById('pedido-items-container');
      container.innerHTML = '';
      (lista.items || []).forEach(item => {
        const row = document.createElement('div');
        row.className = 'pedido-item-row';
        row.innerHTML = `
          <span class="pedido-item-nombre">${escapeHtml(item.productoNombre)}</span>
          <div class="pedido-item-cantidades">
            <label>Pedido: <input type="number" class="input pedido-item-cant" value="${item.cantidad}" min="0.1" step="0.1" style="width:65px"></label>
          </div>
          <input type="hidden" class="pedido-item-prod-id" value="${item.productoId}">
          <input type="hidden" class="pedido-item-prod-nombre" value="${item.productoNombre}">
        `;
        container.appendChild(row);
      });

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
      document.getElementById('modal-pedido').classList.add('open');
    } catch (e) { showToast('Error'); }
  });

  document.getElementById('btn-add-pedido-item').addEventListener('click', () => {
    const container = document.getElementById('pedido-items-container');
    const row = document.createElement('div');
    row.className = 'pedido-item-row';
    row.innerHTML = `
      <select class="input pedido-item-select" style="flex:1">
        <option value="">Seleccionar producto...</option>
      </select>
      <div class="pedido-item-cantidades">
        <label>Pedido: <input type="number" class="input pedido-item-cant" value="1" min="0.1" step="0.1" style="width:65px"></label>
      </div>
      <button type="button" class="btn-icon remove-pedido-item" title="Quitar">❌</button>
    `;
    container.appendChild(row);
    loadProductosSelect(row.querySelector('.pedido-item-select'), null);
    row.querySelector('.remove-pedido-item').addEventListener('click', () => row.remove());
  });

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
    rows.forEach(row => {
      const select = row.querySelector('.pedido-item-select');
      const cantInput = row.querySelector('.pedido-item-cant');
      const hiddenId = row.querySelector('.pedido-item-prod-id');
      const hiddenName = row.querySelector('.pedido-item-prod-nombre');

      let prodId, prodNombre, cantidad;

      if (select) {
        if (!select.value) return;
        const opt = select.options[select.selectedIndex];
        prodId = Number(select.value);
        prodNombre = opt.text.split(' (')[0];
      } else if (hiddenId) {
        prodId = Number(hiddenId.value);
        prodNombre = hiddenName.value;
      } else {
        return;
      }

      cantidad = parseFloat(cantInput.value);
      if (cantidad > 0) {
        items.push({
          productoId: prodId,
          productoNombre: prodNombre,
          cantidad: cantidad,
          cantidadEntregada: 0,
          unidad: ''
        });
      }
    });

    if (items.length === 0) { showToast('Añade al menos un producto'); return; }

    const data = {
      proveedorId: proveedorId,
      proveedorNombre: proveedorNombre,
      listaId: listaId ? Number(listaId) : null,
      items: items,
      estado: 'pendiente'
    };

    try {
      if (id) {
        data.id = Number(id);
        await DB.pedidos.put(data);
        showToast('Pedido actualizado');
      } else {
        await DB.pedidos.add(data);
        showToast('Pedido creado');
      }
      closeAllModals();
      renderPedidos();
    } catch (e) { showToast('Error al guardar pedido'); }
  });

  // ---- VER PEDIDO ----
  async function viewPedido(id) {
    try {
      const p = await DB.pedidos.get(id);
      if (!p) return;
      let msg = `📋 *PEDIDO #${p.id}*\n`;
      msg += `🏪 Proveedor: ${p.proveedorNombre || '—'}\n`;
      msg += `📅 Fecha: ${formatDate(p.fecha)}\n`;
      msg += `📌 Estado: ${p.estado}\n\n*Productos:*\n`;
      (p.items || []).forEach(item => {
        const entregado = item.cantidadEntregada || 0;
        const icon = entregado >= item.cantidad ? '✅' : (entregado > 0 ? '🟡' : '⬜');
        msg += `${icon} ${item.productoNombre}: pedido ${item.cantidad}, entregado ${entregado}\n`;
      });
      alert(msg);
    } catch (e) { showToast('Error al cargar pedido'); }
  }

  // ---- ENTREGAR PEDIDO ----
  async function entregarPedido(id) {
    try {
      const p = await DB.pedidos.get(id);
      if (!p) return;

      document.getElementById('modal-entrega-title').textContent = `Registrar Entrega - Pedido #${p.id}`;
      document.getElementById('entrega-pedido-id').value = p.id;

      const container = document.getElementById('entrega-items-container');
      container.innerHTML = (p.items || []).map((item, idx) => `
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

      const rows = document.querySelectorAll('#entrega-items-container .entrega-item-row');
      rows.forEach(row => {
        const idx = Number(row.querySelector('.entrega-item-idx').value);
        const cant = parseFloat(row.querySelector('.entrega-item-cant').value) || 0;
        if (p.items[idx]) {
          p.items[idx].cantidadEntregada = cant;
        }
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

      let msg = `📋 *PEDIDO #${p.id}*\n`;
      msg += `🏪 Proveedor: ${p.proveedorNombre || '—'}\n`;
      msg += `📅 Fecha: ${formatDate(p.fecha)}\n`;
      msg += `📌 Estado: ${p.estado}\n\n`;
      msg += `*PRODUCTOS:*\n`;
      (p.items || []).forEach(item => {
        const entregado = item.cantidadEntregada || 0;
        const check = entregado >= item.cantidad ? '✅' : '';
        msg += `• ${item.productoNombre}: ${item.cantidad} ${item.unidad || 'ud'} ${check}\n`;
      });
      msg += `\nTotal productos: ${(p.items || []).length}`;

      const url = `https://wa.me/${telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
      window.location.href = url;
    } catch (e) { showToast('Error al enviar WhatsApp'); }
  }

  async function delPedido(id) {
    if (!confirm('¿Eliminar este pedido?')) return;
    try {
      await DB.pedidos.del(id);
      showToast('Pedido eliminado');
      renderPedidos();
    } catch (e) { showToast('Error al eliminar'); }
  }

  // ---- DASHBOARD ----
  async function renderDashboard() {
    try {
      const [productos, proveedores, listas, pedidos] = await Promise.all([
        DB.productos.getAll(),
        DB.proveedores.getAll(),
        DB.listas.getAll(),
        DB.pedidos.getAll()
      ]);
      document.getElementById('dashboard-productos').textContent = productos.length;
      document.getElementById('dashboard-proveedores').textContent = proveedores.length;
      document.getElementById('dashboard-listas').textContent = listas.length;
      document.getElementById('dashboard-pedidos').textContent = pedidos.length;

      const pendientes = pedidos.filter(p => p.estado === 'pendiente' || p.estado === 'parcial').length;
      document.getElementById('dashboard-pendientes').textContent = pendientes;

      const recentList = document.getElementById('dashboard-recent');
      const recent = pedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);
      if (recent.length === 0) {
        recentList.innerHTML = '<div class="empty-state">No hay pedidos recientes</div>';
      } else {
        recentList.innerHTML = recent.map(p => `
          <div class="recent-item">
            <span>#${p.id} ${escapeHtml(p.proveedorNombre || '—')}</span>
            ${getStatusBadge(p.estado)}
          </div>
        `).join('');
      }
    } catch (e) { /* ignore */ }
  }

  // ---- MODAL CLOSE ----
  document.querySelectorAll('.modal-close, .modal-overlay, .modal-close-btn').forEach(el => {
    el.addEventListener('click', closeAllModals);
  });

  // ---- INICIO ----
  document.addEventListener('DOMContentLoaded', async () => {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
      } catch (e) { /* sw not supported */ }
    }

    // Load initial data
    await Promise.all([
      renderDashboard(),
      renderProductos(),
      renderProveedores(),
      renderListas(),
      renderPedidos()
    ]);

    showSection('inicio');
  });

})();
