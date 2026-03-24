const { Client, Databases, Query, ID } = Appwrite;

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('69c2b5e800103898c0d5');

const databases = new Databases(client);

const DATABASE_ID = '69c2b6bd003bbd25d672';
const COLLECTIONS = {
    USERS: 'users',
    PROJECTS: 'projects',
    VERSIONS: 'versions',
    TICKETS: 'tickets'
};
