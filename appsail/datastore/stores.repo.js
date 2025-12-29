const STORES = new Map();

export async function saveStore(store) {
  STORES.set(store.store_id, store);
  return store;
}

export async function getStore(store_id) {
  return STORES.get(store_id);
}
