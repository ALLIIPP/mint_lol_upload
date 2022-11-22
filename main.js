
//const express = require('express');
import express from 'express';
//const base58 = require('bs58');
import base58 from 'bs58';
//const web3 = require('@solana/web3.js');
import * as web3 from '@solana/web3.js'
//const upload_Queue = require('./uploadQueue.js');
import { uploadQueue } from './uploadQueue.js'
//const connection = new web3.Connection(web3.clusterApiUrl("mainnet-beta"));
import fs from 'fs';
import { bs58 } from '@project-serum/anchor/dist/cjs/utils/bytes/index.js';
import { count } from 'console';
import { fail } from 'assert';
import { connectToOrdersDb, getOrdersDb } from './db.js';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const PORT = 4000;

//TODO fix
const systemKeyPair = web3.Keypair.fromSecretKey(
    new Uint8Array(Buffer.from(JSON.parse(fs.readFileSync('/app/things/mainnet.json'))))
);

const rpcUrl = ''

const app = express();
app.use(express.json({ limit: '2mb' }));
//app.use(express.urlencoded({ limit: "1mb" }))
app.use(function (err, req, res, next) {

    if (err.statusCode == '413') {
        return res.status(413).json({
            "status": "fail",
            "error": "body too large"
        })
    }
})

const invalidError = {
    "status": "fail",
    "error": "invalid pubkey"
}
const invalidOptions = {
    "status": "fail",
    "error": "invalid body"
}

const MAX_UPLOADS = 10;

const COST_PER_NFT = 0.035;

const charset = "abcdefghijklmnopqrstuvwxyz1234567890";

const up = new uploadQueue();

up.connectToMongo();

let db_Orders;
connectToOrdersDb(err => {
    if (err) {
        console.log(err)
    } else {
        console.log('connected to MONGO Orders')
        app.listen(process.env.PORT || PORT, () => {
            console.log('listening for requests on port 4000.....')
        })
        db_Orders = getOrdersDb()
    }
})




 

app.get('/', (req, res) => {
    res.status(200).json({ "ok": "ok" });
})

app.get('/getTransaction', async (req, res) => {

    
    try {

        if (!req.query.pubKey || !req.query.amount) {
            res.status(400).json(invalidError);
            return;

        }
        try {

            let decoded = base58.decode(req.query.pubKey)
            if (decoded.length != 32) {
                res.status(400).json(invalidError);
                return;

            }


        } catch (err) {
            res.status(400).json(invalidError);
            return;
        }


        let userPubkey = new web3.PublicKey(req.query.pubKey);



        let transferTxn = new web3.Transaction().add(
            web3.SystemProgram.transfer({
                fromPubkey: userPubkey, 
                toPubkey: systemKeyPair.publicKey,
                lamports: Math.floor(req.query.amount * COST_PER_NFT * web3.LAMPORTS_PER_SOL)
            }));

 

        transferTxn.feePayer = userPubkey;
        const connection = new web3.Connection(rpcUrl);

        transferTxn.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

        //console.log(transferTxn.recentBlockhash)


        let buffer = transferTxn.serialize({
            //  verifySignatures: false,
            requireAllSignatures: false,
        });



        let encodedTransaction = base58.encode(buffer)

        res.json(
            {
                "status": "success",
                "encodedTransaction": encodedTransaction,


            })
    } catch (e) {
        res.status(500).json({
            "status": "fail",
            "error": "who knows "
        })
    }
})

app.post('/uploadNFT', async (req, res) => {





    // make sure data is there 

    if (!req.body || !req.body.asset || !req.body.pubKeys || !req.body.asset.metadata || !req.body.transaction || !req.body.asset.image) {
        console.log("body null : " + req.body)
        res.status(400).json({ "somthing is null": "ok" });
        return;
    }

    if (req.body.asset.metadata.name != null && req.body.asset.metadata.name.length > 32) {
        res.status(400).json(invalidError);
        return;
    }
    if (req.body.asset.metadata.symbol != null && req.body.asset.metadata.symbol.length > 10) {
        res.status(400).json(invalidError);
        return;
    }
    if (req.body.asset.metadata.description != null && req.body.asset.metadata.description.length > 150) {
        res.status(400).json(invalidError);
        return;
    }



    try {
        if (req.body.pubKeys.length > MAX_UPLOADS) {
            res.status(400).json(invalidError);
            return;
        }
    } catch (err) {
        res.status(400).json(invalidError);
        return;
    }

    let number = 0;
    try {
        for (let i = 0; i < req.body.pubKeys.length; i++) {
            number += req.body.pubKeys[i].amount;
        }
        if (number > MAX_UPLOADS) {
            res.status(400).json(invalidError);
            return;
        }
    } catch (err) {
        res.status(400).json();
        return;
    }


    let txn = web3.Transaction.from(base58.decode(req.body.transaction));
 
    try {
        console.log(number)
        let num = Math.floor(number * COST_PER_NFT * web3.LAMPORTS_PER_SOL);

        let compared = txn._json.instructions[0].data;



        let j = 4;
        for (let i = num.toString(16).length - 1; i > 0; i -= 2) {

            let value = parseInt(num.toString(16)[i - 1] + num.toString(16)[i], 16);

            console.log(value + "     " + compared[j]);
            if (!compared[j] == value) {
                res.status(400).json(invalidError);
                return;
            }

            j++;
        }


        if (txn._json.instructions.length > 1) {
            res.status(400).json(invalidError);
            return;
        }

        if (txn._json.keys > 2) {
            res.status(400).json(invalidError);
            return;
        }
        if (txn._json.instructions[0].programId != '11111111111111111111111111111111') {
            console.log(txn._json.instructions[0].programId);
            res.status(400).json(invalidError);

            return;
        }

        if (txn._json.instructions[0].data[0] != 2 || txn._json.instructions[0].data[1] != 0 || txn._json.instructions[0].data[2] != 0 || txn._json.instructions[0].data[3] != 0) {
            res.status(400).json(invalidError);
            return;
        }

    } catch (e) {
        console.log(e)
        res.status(400).json(invalidError);
        return;
    }

    //try parse image
    let parsed_image;
    try {
        parsed_image = new Buffer.from(req.body.asset.image, 'base64')
    } catch (e) {
        res.status(400).json(invalidError);
        return;
    }


    //send transaction
    const connection = new web3.Connection(rpcUrl);

    let txid;
    let lastBlockHeight = (await connection.getLatestBlockhash()).lastValidBlockHeight;
    let currentBlockHeight = await connection.getBlockHeight();
    let raw_transaction = bs58.decode(req.body.transaction);


    txid = await connection.sendRawTransaction(raw_transaction, {
        skipPreflight: true
    }).catch(err => {
        console.log(err);
    })


    console.log("down here ..................................")
    console.log('txn : ' + txid)
    while (await connection.getTransaction(txid, { commitment: 'confirmed' }) == null) {
        console.log("IN HERE ................................... ")
        await sleep(1000);
        if (lastBlockHeight < currentBlockHeight) {
            console.log("WHATTTTTTTTTTTTTTTTT  ????????")
            res.status(400).json({
                status: fail,
                "message": "transaction timed out"
            })
            return;
        }
        currentBlockHeight = await connection.getBlockHeight();
    }

    // add to Orders in MongoDb



    //create uid
    let uid = "";

    for (let i = 0; i < 10; i++) {
        uid += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    let body = {
        creator: req.body.creator_pubKey,
        pubKeys: req.body.pubKeys,
        transfer_txid: txid,
        size: number,
        time_unix: Date.now(),
        uid: uid,
        name: req.body.asset.metadata.name
    }
    db_Orders.collection('order')
        .insertOne(body)
        .then(result => {
            console.log(result)
        })
        .catch(err => {
            console.log(err)
        })


    let metadata = JSON.parse(fs.readFileSync('./things/template.json'))
    metadata.name = req.body.asset.metadata.name;
    metadata.symbol = req.body.asset.metadata.symbol;
    metadata.description = req.body.asset.metadata.description;
    metadata.attributes = req.body.asset.metadata.attributes;
    metadata.collection.name = req.body.asset.metadata.name;
    metadata.collection.family = req.body.asset.metadata.name;



    console.log("HOW MANYYYYYYYYYYY    :       " + number);

    up.startNewTask(
        {
            tag: uid,
            pubKeys: req.body.pubKeys,
            size: number,
            creator_pubKey: req.body.creator_pubKey,
            isPublic: req.body.isPublic

        },
        {
            image: parsed_image,
            metadata: metadata
        }
    );
    /*
        try - catch parse image base64 
    */





    res.status(200).json({
        status: 'success'
    });

})


/*
    Mint nft flow

    USER -->

        1. USER connects wallet
        2. USER approves transaction
        
    MOBILE -->

        1. Upon connect, MOBILE sends connect deeplink to phantom
        2. After USER approves, Phantom sends deeplink with publickey to MOBILE

        (BACKEND requires pubkey in order to generate transaction to be signed)

        3. Once USER is ready to upload, MOBILE sends pubkey + assets (maybe 1. pubkey 2. unsigned transaction 3. assets) to BACKEND 
        4. BACKEND sends *unsigned* transaction to MOBILE
        5. MOBILE sends deeplink to Phantom with *unsigned* transaction
        6. Phantom sends *signed* transaction back to MOBILE
        7. MOBILE sends *signed* transaction to backend to send transaction
        8. MOBILE displays some success/fail message



    BACKEND

        1. BACKEND receives USER publickey + assets
        2. BACKEND generates *unsigned* transaction (transfer) 
        3. BACKEND sends transaction to MOBILE
        4. BACKEND receives *signed* transaction
 //dontneed       4a. BACKEND checks that transaction is a X SOL transfer from USER pubkey to BACKEND pubkey
 //dontneed       4b. BACKEND sends transaction
         

*/