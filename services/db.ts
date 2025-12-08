
import { HistoryItem, Product, Preset } from '../types';

const DB_NAME = 'PinEmpireDB';
const STORE_NAME = 'history';
const BOARDS_STORE = 'boards';
const PRODUCTS_STORE = 'products';
const PRESETS_STORE = 'presets';
const DB_VERSION = 4; // Incremented version

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("DB Error", event);
      reject("Database error");
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(BOARDS_STORE)) {
        db.createObjectStore(BOARDS_STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        db.createObjectStore(PRODUCTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PRESETS_STORE)) {
        db.createObjectStore(PRESETS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
  });
};

export const saveHistory = async (topic: string, pins: any[]): Promise<number> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const item: Omit<HistoryItem, 'id'> = {
      date: new Date().toISOString(),
      topic: topic.slice(0, 50) + (topic.length > 50 ? '...' : ''),
      pins
    };
    
    const request = store.add(item);
    
    request.onsuccess = (event: any) => resolve(event.target.result as number);
    request.onerror = () => reject("Failed to save history");
  });
};

export const updateProjectPins = async (id: number, pins: any[]): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const data = getRequest.result as HistoryItem;
            if (data) {
                data.pins = pins;
                // Update date to show it was modified recently
                data.date = new Date().toISOString(); 
                store.put(data);
                resolve();
            } else {
                reject("Project not found");
            }
        };
        getRequest.onerror = () => reject("Failed to update project");
    });
};

export const getHistory = async (): Promise<HistoryItem[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const res = request.result as HistoryItem[];
      resolve(res.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    };
    request.onerror = () => reject("Failed to fetch history");
  });
};

export const deleteHistoryItem = async (id: number): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject();
    });
};

export const importHistory = async (items: HistoryItem[]): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        let processedCount = 0;

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject("Import failed");

        items.forEach(item => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...dataToSave } = item; 
            store.add(dataToSave);
            processedCount++;
        });

        if (items.length === 0) resolve();
    });
};

// --- Boards Logic ---

export const getSavedBoards = async (): Promise<string[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([BOARDS_STORE], 'readonly');
        const store = transaction.objectStore(BOARDS_STORE);
        const request = store.getAllKeys();
        
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject("Failed to get boards");
    });
};

export const saveBoardsToDB = async (names: string[]): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([BOARDS_STORE], 'readwrite');
        const store = transaction.objectStore(BOARDS_STORE);
        
        names.forEach(name => {
            store.put({ name, date: new Date().toISOString() });
        });
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject();
    });
};

// --- Products / Assets Library Logic ---

export const getProducts = async (): Promise<Product[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PRODUCTS_STORE], 'readonly');
        const store = transaction.objectStore(PRODUCTS_STORE);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result as Product[]);
        request.onerror = () => reject("Failed to fetch products");
    });
};

export const saveProduct = async (product: Product): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PRODUCTS_STORE], 'readwrite');
        const store = transaction.objectStore(PRODUCTS_STORE);
        store.put(product);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject("Failed to save product");
    });
};

export const deleteProduct = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PRODUCTS_STORE], 'readwrite');
        const store = transaction.objectStore(PRODUCTS_STORE);
        store.delete(id);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject("Failed to delete product");
    });
};

// --- Presets Logic ---

export const getPresets = async (): Promise<Preset[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PRESETS_STORE], 'readonly');
        const store = transaction.objectStore(PRESETS_STORE);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result as Preset[]);
        request.onerror = () => reject("Failed to fetch presets");
    });
};

export const savePreset = async (preset: Preset): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PRESETS_STORE], 'readwrite');
        const store = transaction.objectStore(PRESETS_STORE);
        store.put(preset);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject("Failed to save preset");
    });
};

export const deletePreset = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([PRESETS_STORE], 'readwrite');
        const store = transaction.objectStore(PRESETS_STORE);
        store.delete(id);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject("Failed to delete preset");
    });
};
