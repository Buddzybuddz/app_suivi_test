/**
 * MockDatabases - A simple simulation of Appwrite's Databases API using localStorage.
 * This is used for local development to avoid hitting the Appwrite production database.
 */
class MockDatabases {
    constructor(client) {
        this.client = client;
    }

    _getStorageKey(collectionId) {
        return `mock_db_${collectionId}`;
    }

    _getData(collectionId) {
        const data = localStorage.getItem(this._getStorageKey(collectionId));
        return data ? JSON.parse(data) : [];
    }

    _setData(collectionId, data) {
        localStorage.setItem(this._getStorageKey(collectionId), JSON.stringify(data));
    }

    async listDocuments(databaseId, collectionId, queries = []) {
        console.log(`[MockDB] listDocuments from ${collectionId}`);
        const documents = this._getData(collectionId);
        // Basic implementation of queries if needed could go here
        return {
            total: documents.length,
            documents: documents
        };
    }

    async createDocument(databaseId, collectionId, documentId, data) {
        console.log(`[MockDB] createDocument in ${collectionId}`, data);
        const documents = this._getData(collectionId);
        const id = documentId === 'unique()' || !documentId ? Math.random().toString(36).substr(2, 9) : documentId;
        const newDoc = {
            $id: id,
            $createdAt: new Date().toISOString(),
            $updatedAt: new Date().toISOString(),
            $permissions: [],
            $databaseId: databaseId,
            $collectionId: collectionId,
            ...data
        };
        documents.push(newDoc);
        this._setData(collectionId, documents);
        return newDoc;
    }

    async updateDocument(databaseId, collectionId, documentId, data) {
        console.log(`[MockDB] updateDocument in ${collectionId} ID:${documentId}`, data);
        const documents = this._getData(collectionId);
        const index = documents.findIndex(doc => doc.$id === documentId);
        if (index === -1) throw new Error("Document not found");
        
        documents[index] = {
            ...documents[index],
            ...data,
            $updatedAt: new Date().toISOString()
        };
        this._setData(collectionId, documents);
        return documents[index];
    }

    async deleteDocument(databaseId, collectionId, documentId) {
        console.log(`[MockDB] deleteDocument in ${collectionId} ID:${documentId}`);
        let documents = this._getData(collectionId);
        documents = documents.filter(doc => doc.$id !== documentId);
        this._setData(collectionId, documents);
        return {};
    }
}

// Global ID mock for ID.unique()
const MockID = {
    unique: () => 'unique()'
};

// Global Query mock if used
const MockQuery = {
    equal: (key, value) => ({ key, value, type: 'equal' }),
    limit: (limit) => ({ limit, type: 'limit' }),
    orderAsc: (key) => ({ key, type: 'orderAsc' }),
    orderDesc: (key) => ({ key, type: 'orderDesc' })
};
