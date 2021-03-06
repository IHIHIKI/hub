export abstract class Store<Info, Entry> {
    private static INDEXEDDB_IMPLEMENTATION = window.indexedDB;

    private _dbPromise: Promise<IDBDatabase> | null;
    private _indexedDB: IDBFactory;

    protected abstract get DB_NAME(): string;
    protected abstract get DB_STORE_NAME(): string;
    protected abstract get DB_VERSION(): number;

    protected constructor() {
        this._dbPromise = null;
        this._indexedDB = Store.INDEXEDDB_IMPLEMENTATION;
    }

    public async get(id: string): Promise<Info | null> {
        const db = await this.connect();
        const transaction = db.transaction(this.DB_STORE_NAME, 'readonly');
        const request = transaction.objectStore(this.DB_STORE_NAME).get(id);
        const result = await this._requestAsPromise(request, transaction);
        return result ? this.fromEntry(result) : result;
    }

    public async put(value: Info) {
        const db = await this.connect();
        const transaction = db.transaction(this.DB_STORE_NAME, 'readwrite');
        const request = transaction.objectStore(this.DB_STORE_NAME).put(this.toEntry(value));
        return this._requestAsPromise(request, transaction);
    }

    public async remove(id: string) {
        const db = await this.connect();
        const transaction = db.transaction(this.DB_STORE_NAME, 'readwrite');
        const request = transaction.objectStore(this.DB_STORE_NAME).delete(id);
        return this._requestAsPromise(request, transaction);
    }

    public async list(): Promise<Entry[]> {
        const db = await this.connect();
        const request = db.transaction(this.DB_STORE_NAME, 'readonly')
            .objectStore(this.DB_STORE_NAME)
            .openCursor();
        return this._readAllFromCursor(request);
    }

    public async close() {
        if (!this._dbPromise) {
            return;
        }
        // If failed to open database (i.e. dbPromise rejects) we don't need to close the db
        const db = await this._dbPromise.catch(() => null);
        this._dbPromise = null;
        if (db) {
            db.close();
        }
    }

    protected abstract upgrade(request: IDBOpenDBRequest, event: IDBVersionChangeEvent): void;

    protected abstract toEntry(info: Info): Entry;

    protected abstract fromEntry(entry: Entry): Info;

    private async connect(): Promise<IDBDatabase> {
        if (this._dbPromise) {
            return this._dbPromise;
        }

        this._dbPromise = new Promise((resolve, reject) => {
            const request = this._indexedDB.open(this.DB_NAME, this.DB_VERSION);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = (event) => this.upgrade(request, event);
        });
        return this._dbPromise;
    }

    private async _requestAsPromise(request: IDBRequest, transaction: IDBTransaction): Promise<any> {
        return Promise.all([
            new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onabort = () => reject(transaction.error);
                transaction.onerror = () => reject(transaction.error);
            }),
        ])
        // Promise.all returns an array of resolved promises, but we are only
        // interested in the request.result, which is the first item.
        .then((result) => result[0]);
    }

    private _readAllFromCursor(request: IDBRequest): Promise<Entry[]> {
        return new Promise((resolve, reject) => {
            const results: any[] = [];
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
}
