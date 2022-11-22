import { MongoClient } from 'mongodb'

const URL_COMMUNITY_NFTS = ''

const URL_COMMUNITY_COMMENTS = '';

const URL_ORDERS_ORDER = ''




let dbCommunityNftConnection;
let dbCommunityCommentsConnection;
let dbOrdersConnection;



async function connectToCommunnityNftDb(cb) {
    await MongoClient.connect(URL_COMMUNITY_NFTS)
        .then((client) => {
            dbCommunityNftConnection = client.db();
            return cb(null)
        })
        .catch((err) => {
            console.log(err);
            return cb(err)
        })
}

function getCommunityNftDb() { return dbCommunityNftConnection }

async function connectToCommunityCommentsDb(cb) {
    await MongoClient.connect(URL_COMMUNITY_COMMENTS)
        .then((client) => {
            dbCommunityCommentsConnection = client.db();
            return cb(null)
        })
        .catch((err) => {
            console.log(err);
            return cb(err)
        })
}
function getCommunityCommentsDb() { return dbCommunityCommentsConnection }

async function connectToOrdersDb(cb) {
    await MongoClient.connect(URL_ORDERS_ORDER)
        .then(client => {
            dbOrdersConnection = client.db();
            return cb(null)
        })
        .catch((err) => {
            console.log(err)
            return cb(err)
        })
}

function getOrdersDb() { return dbOrdersConnection }


export { connectToCommunnityNftDb, connectToCommunityCommentsDb, connectToOrdersDb, getCommunityCommentsDb, getCommunityNftDb, getOrdersDb }

