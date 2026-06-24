const DB_NAME = 'PedidosDB';
const DB_VER = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('productos')) {
        const ps = db.createObjectStore('productos', { keyPath: 'id', autoIncrement: true });
        ps.createIndex('nombre', 'nombre', { unique: false });
      }
      if (!db.objectStoreNames.contains('proveedores')) {
        const ps = db.createObjectStore('proveedores', { keyPath: 'id', autoIncrement: true });
        ps.createIndex('nombre', 'nombre', { unique: false });
      }
      if (!db.objectStoreNames.contains('listas')) {
        const ls = db.createObjectStore('listas', { keyPath: 'id', autoIncrement: true });
        ls.createIndex('nombre', 'nombre', { unique: false });
      }
      if (!db.objectStoreNames.contains('pedidos')) {
        const os = db.createObjectStore('pedidos', { keyPath: 'id', autoIncrement: true });
        os.createIndex('fecha', 'fecha', { unique: false });
        os.createIndex('proveedorId', 'proveedorId', { unique: false });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function tx(store, mode) {
  return openDB().then(db => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    return { t, s, db };
  });
}

const DB = {
  // Productos
  productos: {
    getAll() {
      return tx('productos', 'readonly').then(({ s, db }) => new Promise((resolve, reject) => {
        const req = s.getAll();
        req.onsuccess = () => { db.close(); resolve(req.result || []); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    get(id) {
      return tx('productos', 'readonly').then(({ s, db }) => new Promise((resolve, reject) => {
        const req = s.get(id);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    add(data) {
      return tx('productos', 'readwrite').then(({ s, db }) => new Promise((resolve, reject) => {
        data.creadoEn = new Date().toISOString();
        const req = s.add(data);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    put(data) {
      return tx('productos', 'readwrite').then(({ s, db }) => new Promise((resolve, reject) => {
        data.modificadoEn = new Date().toISOString();
        const req = s.put(data);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    del(id) {
      return tx('productos', 'readwrite').then(({ s, db }) => new Promise((resolve, reject) => {
        const req = s.delete(id);
        req.onsuccess = () => { db.close(); resolve(); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    }
  },
  // Proveedores
  proveedores: {
    getAll() {
      return tx('proveedores', 'readonly').then(({ s, db }) => new Promise((resolve, reject) => {
        const req = s.getAll();
        req.onsuccess = () => { db.close(); resolve(req.result || []); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    get(id) {
      return tx('proveedores', 'readonly').then(({ s, db }) => new Promise((resolve, reject) => {
        const req = s.get(id);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    add(data) {
      return tx('proveedores', 'readwrite').then(({ s, db }) => new Promise((resolve, reject) => {
        data.creadoEn = new Date().toISOString();
        const req = s.add(data);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    put(data) {
      return tx('proveedores', 'readwrite').then(({ s, db }) => new Promise((resolve, reject) => {
        data.modificadoEn = new Date().toISOString();
        const req = s.put(data);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    del(id) {
      return tx('proveedores', 'readwrite').then(({ s, db }) => new Promise((resolve, reject) => {
        const req = s.delete(id);
        req.onsuccess = () => { db.close(); resolve(); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    }
  },
  // Listas de compra
  listas: {
    getAll() {
      return tx('listas', 'readonly').then(({ s, db }) => new Promise((resolve, reject) => {
        const req = s.getAll();
        req.onsuccess = () => { db.close(); resolve(req.result || []); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    get(id) {
      return tx('listas', 'readonly').then(({ s, db }) => new Promise((resolve, reject) => {
        const req = s.get(id);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    add(data) {
      return tx('listas', 'readwrite').then(({ s, db }) => new Promise((resolve, reject) => {
        data.creadoEn = new Date().toISOString();
        data.items = data.items || [];
        const req = s.add(data);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    put(data) {
      return tx('listas', 'readwrite').then(({ s, db }) => new Promise((resolve, reject) => {
        data.modificadoEn = new Date().toISOString();
        const req = s.put(data);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    del(id) {
      return tx('listas', 'readwrite').then(({ s, db }) => new Promise((resolve, reject) => {
        const req = s.delete(id);
        req.onsuccess = () => { db.close(); resolve(); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    }
  },
  // Pedidos
  pedidos: {
    getAll() {
      return tx('pedidos', 'readonly').then(({ s, db }) => new Promise((resolve, reject) => {
        const req = s.getAll();
        req.onsuccess = () => { db.close(); resolve(req.result || []); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    get(id) {
      return tx('pedidos', 'readonly').then(({ s, db }) => new Promise((resolve, reject) => {
        const req = s.get(id);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    add(data) {
      return tx('pedidos', 'readwrite').then(({ s, db }) => new Promise((resolve, reject) => {
        data.fecha = new Date().toISOString();
        data.estado = 'pendiente';
        data.items = data.items || [];
        const req = s.add(data);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    put(data) {
      return tx('pedidos', 'readwrite').then(({ s, db }) => new Promise((resolve, reject) => {
        data.modificadoEn = new Date().toISOString();
        const req = s.put(data);
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    },
    del(id) {
      return tx('pedidos', 'readwrite').then(({ s, db }) => new Promise((resolve, reject) => {
        const req = s.delete(id);
        req.onsuccess = () => { db.close(); resolve(); };
        req.onerror = () => { db.close(); reject(req.error); };
      }));
    }
  }
};
