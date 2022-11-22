import * as web3 from '@solana/web3.js'

import * as spl from '@solana/spl-token';




const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const TOKEN_PROGRAM_ID = new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}




export async function sendWithRetry(connection, mint, user_publickey, systemKeyPair) {


    let user = new web3.PublicKey(user_publickey);

 


    const fromTokenAccount = (await web3.PublicKey.findProgramAddress([systemKeyPair.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID))[0];

    const user_associatedToken = await spl.getAssociatedTokenAddress(
        mint,
        user
    );


    let transaction = new web3.Transaction()
        .add(
            spl.createAssociatedTokenAccountInstruction(
                systemKeyPair.publicKey,
                user_associatedToken,
                user,
                mint
            )
        )
        .add(
            spl.createTransferInstruction(
                fromTokenAccount,
                user_associatedToken,
                systemKeyPair.publicKey,
                1
            )
        )

    transaction.feePayer = systemKeyPair.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;


    let txid;

    let lastBlockHeight = (await connection.getLatestBlockhash()).lastValidBlockHeight;
    let currentBlockHeight = await connection.getBlockHeight();

    console.log('befoe initial send')
    console.log(JSON.stringify(fromTokenAccount))
    while (!txid) {
        txid = await web3.sendAndConfirmTransaction(
            connection,
            transaction,
            [systemKeyPair],
            { skipPreflight: true }
        ).catch((err) => {
            console.log(err)
        });
    }

    console.log('after initial send')
    //while transaction is null or transaction.err is not null 
    // will continue if transaction is not null and trans.err i not

    let confirmed_txn;
    try {
        confirmed_txn = await connection.getTransaction(txid, { commitment: 'confirmed' }).catch((err) => { console.log(err) })
    } catch (err) {
        console.log(err)
    }

    while (confirmed_txn == null) {


        if (currentBlockHeight < lastBlockHeight) {
            await sleep(1000);
        } else {

            console.log('trying to send')
            transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            txid = await web3.sendAndConfirmTransaction(
                connection,
                transaction,
                [systemKeyPair],
                { skipPreflight: true }


            ).catch((err) => {

                console.log("why lol " + err);
            })
            lastBlockHeight = (await connection.getLatestBlockhash()).lastValidBlockHeight;
        }
        currentBlockHeight = await connection.getBlockHeight();


        try {
            confirmed_txn = await connection.getTransaction(txid, { commitment: 'confirmed' }).catch((err) => { console.log(err) })
        } catch (err) {
            console.log(err)
        }



    }
    console.log('sent')
    return txid;


}
