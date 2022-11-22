import fs from 'fs';
import * as web3 from '@solana/web3.js'
import path from 'path';
import * as uploadHelper from './uploadHelper.js'
import { connectToCommunityCommentsDb, connectToCommunnityNftDb, getCommunityCommentsDb, getCommunityNftDb } from './db.js'
import AWS from 'aws-sdk'
import * as Metaplex from '@metaplex-foundation/js'
import { keypairIdentity } from '@metaplex-foundation/js';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const rpcUrl = '';


const keyPairPath = '/app/things/mainnet.json';
const systemKeyPair = web3.Keypair.fromSecretKey(
    new Uint8Array(Buffer.from(JSON.parse(fs.readFileSync('/app/things/mainnet.json'))))
);



const s3 = new AWS.S3({
    accessKeyId: '',
    secretAccessKey: ''
})


let db_community_comments;
let db_community_nfts;


export class uploadQueue {

    constructor() {

    }

    connectToMongo() {
        console.log('trying to connect to mongo')
        connectToCommunnityNftDb((err) => {
            if (!err) {
                connectToCommunityCommentsDb(err => {
                    if (!err) {
                        db_community_comments = getCommunityCommentsDb();
                        db_community_nfts = getCommunityNftDb();

                        if (db_community_comments == undefined) {
                            console.log('1 undefined')
                        }
                        if (db_community_nfts == undefined) {
                            console.log('2 undefined')
                        }
                    } else {
                        console.log("???????????????????? : " + err);
                        return false;
                    }
                })

            } else {
                console.log("???????????????????? : " + err);
                return false;

            }
        })
    }

    uploadtoMongo(task) {
        let body = {
            image: '' + task.tag + '/0.png',
            metadata: '' + task.tag + '/0.json',
            likes: [],
            likesCount: 0,
            creator: task.creator_pubKey,
            created_At: Date.now()
        }
        db_community_nfts.collection('community_nfts')
            .insertOne(body)
            .then(result => {

                console.log(result.insertedId.toString());
                //create comments database for uploaded nft
                connectToCommunityCommentsDb(err => {
                    if (!err) {

                        db_community_comments.createCollection(result.insertedId.toString(), (err, res) => {
                            if (err) {
                                console.log(err + 'lmao');
                            } else {
                                console.log("comments section created successfully ");
                            }
                        })
                    } else {
                        console.log(err + "????????????????????????");
                    }
                })
            })
            .catch(err => {
                console.log(err);
            })


    }



    startNewTask = (meta, assets) => {

        /*
            after get transaction -> upload X number of assets -> send assets

            for( i<amount) - > upload asset -> send
        */



        this.uploadAssets(meta.tag, assets)
            .then((link) => {
                return this.mintNFT(link, assets.metadata.name, assets.metadata.symbol, assets.metadata.sellerFeeBasisPoints, meta.size)
            })
            .then((mints) => {
                console.log('MINTS LENGTH : ' + mints.length)
                this.sendNFT(mints, meta.pubKeys)
            })
            .then(() => {
                if (meta.isPublic) {
                    this.uploadtoMongo(meta);
                }
            })


        // work on current task
        /*    console.log("TRYING upload")
            this.uploadNFT(current_task.tag)
                .then(() => {
                    console.log("TRYING mintNFT")
                    return this.mintNFT(current_task.tag, current_task.size);
                })
                .then((mints) => {
                    if (mints == null) {
                        current_task.isBeingWorked = false;
                        this.startNewTask(current_task);
                        return;
                    } else {
                        console.log("TRYING sendNFT")
                        this.sendNFT(mints, current_task.pubKeys);
                    }
    
                })
                .then(() => {
                    if (current_task.isPublic) {
                        this.uploadtoMongo(current_task);
                    }
                })
                .then(() => {
                    console.log("TRYING deQueue")
                    this.removeTask(current_task);
                })
                .then(() => {
                    this.startNewTask();
                });
    */
        /*

            add community nft to databse if public set to true 
        */


    }

    /*
    /->/app->/things->/uploadables->[bunch of shit]
 
    1 bunch of shit -> 0.png, 0.json, .cache
    */

    uploadAssets = async (tag, assets) => {



        let image_params = {
            Bucket: '',
            Key: tag + '/0.png',
            Body: assets.image
        }


        let local = await s3.upload(image_params, async (err, data) => {
            if (err) {
                await sleep(5000)
                this.uploadAssets(tag, assets)
            }

        }).promise()

        assets.metadata.image = local.Location
        let metadata_params = {
            Bucket: '',
            Key: tag + '/0.json',
            Body: JSON.stringify(assets.metadata)
        }

        let url = await s3.upload(metadata_params, async (err_, data_) => {
            if (err_) {
                await sleep(5000)
                this.uploadAssets(tag, assets)
            }

        }).promise()

        return url.Location


    }
    mintNFT = async (link, name, symbol, sellerFeeBasisPoints, size) => {


        let mints = []
        const connection = new web3.Connection(rpcUrl);
        const metaplex = Metaplex.Metaplex.make(connection).use(keypairIdentity(systemKeyPair))
        

        do {
            try {

                let nfts = await metaplex
                    .nfts()
                    .create({
                        uri: link,
                        name: name,
                        symbol: symbol,
                        sellerFeeBasisPoints: sellerFeeBasisPoints,
                    })
                    .run()
                if (nfts != null && nfts != undefined && nfts.mintAddress != null) {
                    mints.push(nfts.mintAddress)
                }
                
            } catch (e) {
                    console.log(e)
            }
        } while (mints.length != size)
        console.log('MINTS LENGTH HERE : ' + mints.length)
        return mints;



    }

    //TODO mint id and userpublickey should be a hashmap

    //sendNFT should run a for loop for each token minted
    sendNFT = async (mints, pubKeys) => {

        //for each item in task size
        await sleep(5000)
        const connection = new web3.Connection(rpcUrl);
        for (let i = 0; i < pubKeys.length; i++) {
            for (let k = 0; k < pubKeys[i].amount; k++) {

                // have to retry based on blockheight 
                console.log('MINTS LAST :   ' + mints.length)
                try {
                    let mint = new web3.PublicKey(mints.shift())
                    await uploadHelper.sendWithRetry(connection, mint, pubKeys[i].pubkey, systemKeyPair)
                } catch (err) {
                    console.log('yuh' + err);
                }

            }
        }

    }


}


