// Offline Storage Layer for POS System
import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Define the database schema
interface POSDatabase extends DBSchema {
  products: {
    key: string;
    value: any;
    indexes: {
      'by-name': string;
      'by-barcode': string;
      'by-category': string;
    };
  };
  customers: {
    key: string;
    value: any;
    indexes: {
      'by-phone': string;
      'by-email': string;
    };
  };
  transactions: {
    key: string;
    value: any;
    indexes: {
      'by-date': string;
      'by-status': string;
      'by-sync-status': string;
    };
  };
  settings: {
    key: string;
    value: any;
  };
  sync_queue: {
    key: string;
    value: {
      id: string;
      type: 'transaction' | 'customer' | 'product_update';
      data: any;
      timestamp: number;
      retries: number;
      status: 'pending' | 'syncing' | 'synced' | 'failed';
    };
    indexes: {
      'by-type': string;
      'by-status': string;
    };
  };
}

class OfflineStorage {
  private db: IDBPDatabase<POSDatabase> | null = null;
  private dbName = 'pos-offline-db';
  private version = 1;

  async init(): Promise<void> {
    try {
      this.db = await openDB<POSDatabase>(this.dbName, this.version, {
        upgrade(db) {
          // Products store
          if (!db.objectStoreNames.contains('products')) {
            const productsStore = db.createObjectStore('products', { keyPath: '_id' });
            productsStore.createIndex('by-name', 'name');
            productsStore.createIndex('by-barcode', 'barcode');
            productsStore.createIndex('by-category', 'category');
          }

          // Customers store
          if (!db.objectStoreNames.contains('customers')) {
            const customersStore = db.createObjectStore('customers', { keyPath: '_id' });
            customersStore.createIndex('by-phone', 'phone');
            customersStore.createIndex('by-email', 'email');
          }

          // Transactions store
          if (!db.objectStoreNames.contains('transactions')) {
            const transactionsStore = db.createObjectStore('transactions', { keyPath: 'id' });
            transactionsStore.createIndex('by-date', 'timestamp');
            transactionsStore.createIndex('by-status', 'status');
            transactionsStore.createIndex('by-sync-status', 'syncStatus');
          }

          // Settings store
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }

          // Sync queue store
          if (!db.objectStoreNames.contains('sync_queue')) {
            const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
            syncStore.createIndex('by-type', 'type');
            syncStore.createIndex('by-status', 'status');
          }
        },
      });
      console.log('Offline database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize offline database:', error);
      throw error;
    }
  }

  // Products operations
  async saveProducts(products: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const tx = this.db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    
    for (const product of products) {
      await store.put({
        ...product,
        lastUpdated: Date.now(),
        syncStatus: 'synced'
      });
    }
    
    await tx.done;
    console.log(`Saved ${products.length} products to offline storage`);
  }

  async getProducts(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAll('products');
  }

  async searchProducts(query: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const products = await this.db.getAll('products');
    const searchTerm = query.toLowerCase();
    
    return products.filter(product => 
      product.name?.toLowerCase().includes(searchTerm) ||
      product.barcode?.toLowerCase().includes(searchTerm) ||
      product.category?.toLowerCase().includes(searchTerm)
    );
  }

  async getProductByBarcode(barcode: string): Promise<any | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const products = await this.db.getAllFromIndex('products', 'by-barcode', barcode);
    return products.length > 0 ? products[0] : null;
  }

  // Customers operations
  async saveCustomers(customers: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const tx = this.db.transaction('customers', 'readwrite');
    const store = tx.objectStore('customers');
    
    for (const customer of customers) {
      await store.put({
        ...customer,
        lastUpdated: Date.now(),
        syncStatus: 'synced'
      });
    }
    
    await tx.done;
    console.log(`Saved ${customers.length} customers to offline storage`);
  }

  async getCustomers(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAll('customers');
  }

  async searchCustomers(query: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const customers = await this.db.getAll('customers');
    const searchTerm = query.toLowerCase();
    
    return customers.filter(customer => 
      customer.name?.toLowerCase().includes(searchTerm) ||
      customer.phone?.includes(query) ||
      customer.email?.toLowerCase().includes(searchTerm)
    );
  }

  // Transactions operations
  async saveTransaction(transaction: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const offlineTransaction = {
      ...transaction,
      id: transaction.id || `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      syncStatus: navigator.onLine ? 'pending' : 'offline',
      createdOffline: !navigator.onLine
    };
    
    await this.db.put('transactions', offlineTransaction);
    
    // Add to sync queue if offline
    if (!navigator.onLine) {
      await this.addToSyncQueue('transaction', offlineTransaction);
    }
    
    console.log('Transaction saved to offline storage:', offlineTransaction.id);
  }

  async getTransactions(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAll('transactions');
  }

  async getPendingTransactions(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAllFromIndex('transactions', 'by-sync-status', 'pending');
  }

  // Sync queue operations
  async addToSyncQueue(type: 'transaction' | 'customer' | 'product_update', data: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const syncItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending' as const
    };
    
    await this.db.put('sync_queue', syncItem);
    console.log('Added item to sync queue:', syncItem.id);
  }

  async getSyncQueue(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAllFromIndex('sync_queue', 'by-status', 'pending');
  }

  async markSyncComplete(syncId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const item = await this.db.get('sync_queue', syncId);
    if (item) {
      item.status = 'synced';
      await this.db.put('sync_queue', item);
    }
  }

  async markSyncFailed(syncId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const item = await this.db.get('sync_queue', syncId);
    if (item) {
      item.status = 'failed';
      item.retries += 1;
      await this.db.put('sync_queue', item);
    }
  }

  // Settings operations
  async saveSetting(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('settings', { key, value, lastUpdated: Date.now() });
  }

  async getSetting(key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    const setting = await this.db.get('settings', key);
    return setting?.value;
  }

  // Utility methods
  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stores = ['products', 'customers', 'transactions', 'settings', 'sync_queue'];
    for (const storeName of stores) {
      await this.db.clear(storeName as any);
    }
    
    console.log('All offline data cleared');
  }

  async getStorageInfo(): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    
    const productsCount = (await this.db.getAll('products')).length;
    const customersCount = (await this.db.getAll('customers')).length;
    const transactionsCount = (await this.db.getAll('transactions')).length;
    const pendingSyncCount = (await this.getSyncQueue()).length;
    
    return {
      products: productsCount,
      customers: customersCount,
      transactions: transactionsCount,
      pendingSync: pendingSyncCount,
      lastUpdated: new Date().toISOString()
    };
  }
}

// Create singleton instance
export const offlineStorage = new OfflineStorage();

// Initialize on module load
offlineStorage.init().catch(console.error);

export default offlineStorage;