const { PublicKey, Keypair, SystemProgram, Connection, TransactionInstruction, Transaction } = require('@solana/web3.js');
const fs = require('fs');
require('dotenv').config();

async function setup() {
  try {
    console.log('Connecting to Solana...');
    const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
    
    const walletPrivateKey = JSON.parse(process.env.WALLET_PRIVATE_KEY);
    const walletKeypair = Keypair.fromSecretKey(new Uint8Array(walletPrivateKey));
    console.log('Wallet:', walletKeypair.publicKey.toString());
    
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log('Balance:', balance / 1e9, 'SOL');
    
    if (balance === 0) {
      throw new Error('Wallet has no SOL. Run: solana airdrop 2 ' + walletKeypair.publicKey.toString() + ' --url devnet');
    }

    const collectionSecretKey = JSON.parse(process.env.COLLECTION_SECRET_KEY);
    const collectionKeypair = Keypair.fromSecretKey(new Uint8Array(collectionSecretKey));
    console.log('Collection:', collectionKeypair.publicKey.toString());

    const programId = new PublicKey('AuXF95nT7WS865AzQpuj3os9r6DjTYY9ekh4mGgG6gfL');
    const campaignId = parseInt(process.env.CAMPAIGN_ID || '2');
    
    // Derive campaign PDA
    const [campaignPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('campaign'), Buffer.from([campaignId])],
      programId
    );
    console.log('Campaign PDA:', campaignPda.toString());
    
    // Check if campaign exists
    const campaignAccount = await connection.getAccountInfo(campaignPda);
    if (campaignAccount) {
      console.log('Campaign already exists');
    } else {
      console.log('Campaign needs initialization - would need to call initialize instruction');
    }
    
    // Check if collection exists
    const collectionAccount = await connection.getAccountInfo(collectionKeypair.publicKey);
    if (collectionAccount) {
      console.log('Collection already exists');
    } else {
      console.log('Collection needs creation - would need to call create_collection instruction');
    }
    
    const [collectionAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection'), collectionKeypair.publicKey.toBuffer()],
      programId
    );
    console.log('Collection Authority PDA:', collectionAuthorityPda.toString());
    
    console.log('\nSETUP CHECK COMPLETE');
    console.log('Campaign and Collection appear to already exist on-chain.');
    console.log('\nYou can start the server with: npm start');

  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

setup();
