// Environment Detection
const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' || 
                window.location.protocol === 'file:';

let databases, Query, ID;

if (isLocal) {
    console.log("🚀 Running in DEV mode (using Mock Database)");
    // Mock classes should be defined in mock_db.js and loaded before this script
    databases = new MockDatabases();
    Query = MockQuery;
    ID = MockID;
} else {
    console.log("🌐 Running in PROD mode (using Appwrite)");
    const { Client, Databases, Query: AppwriteQuery, ID: AppwriteID } = Appwrite;
    const client = new Client()
        .setEndpoint('https://fra.cloud.appwrite.io/v1')
        .setProject('69c2b5e800103898c0d5');
    
    databases = new Databases(client);
    Query = AppwriteQuery;
    ID = AppwriteID;
}

const DATABASE_ID = '69c2b6bd003bbd25d672';
const COLLECTIONS = {
    USERS: 'users',
    PROJECTS: 'projects',
    VERSIONS: 'versions',
    TICKETS: 'tickets'
};
