const express = require('express');
const cors = require('cors');
const { PublicKey, Keypair, SystemProgram, Connection, TransactionInstruction, Transaction } = require('@solana/web3.js');
const bs58 = require('bs58');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');

const walletPrivateKey = JSON.parse(process.env.WALLET_PRIVATE_KEY);
const payerKeypair = Keypair.fromSecretKey(new Uint8Array(walletPrivateKey));

const COLLECTION_ADDRESS = new PublicKey(process.env.COLLECTION_ADDRESS || '3ZQPh5QRLuGfNhY3hbCC8e5AYiLEaWaFoYVxdvTpz9gi');
const PROGRAM_ID = new PublicKey('AuXF95nT7WS865AzQpuj3os9r6DjTYY9ekh4mGgG6gfL');
const CORE_PROGRAM_ID = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');

console.log('Server ready');
console.log('Program:', PROGRAM_ID.toString());
console.log('Payer:', payerKeypair.publicKey.toString());
console.log('Collection:', COLLECTION_ADDRESS.toString());

app.get('/health', async (req, res) => {
  const balance = await connection.getBalance(payerKeypair.publicKey);
  res.json({
    status: 'ok',
    programId: PROGRAM_ID.toString(),
    payer: payerKeypair.publicKey.toString(),
    balance: balance / 1e9,
    collection: COLLECTION_ADDRESS.toString()
  });
});

app.post('/mint-campaign-nft', async (req, res) => {
  try {
    const { wallet, bugId, name, imageUri } = req.body;

    if (!wallet || !bugId || !name || !imageUri) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const assetKeypair = Keypair.generate();
    
    const [collectionAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection'), COLLECTION_ADDRESS.toBuffer()],
      PROGRAM_ID
    );
    
    // mint_nft discriminator
    const discriminator = Buffer.from([211, 57, 6, 167, 15, 219, 35, 251]);
    
    // Serialize arguments: bug_id (u8), name (string), nft_uri (string)
    const bugIdBuf = Buffer.alloc(1);
    bugIdBuf.writeUInt8(bugId);
    
    const nameLen = Buffer.alloc(4);
    nameLen.writeUInt32LE(name.length);
    const nameBuf = Buffer.from(name);
    
    const uriLen = Buffer.alloc(4);
    uriLen.writeUInt32LE(imageUri.length);
    const uriBuf = Buffer.from(imageUri);
    
    const data = Buffer.concat([discriminator, bugIdBuf, nameLen, nameBuf, uriLen, uriBuf]);
    
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: payerKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: assetKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: COLLECTION_ADDRESS, isSigner: false, isWritable: true },
        { pubkey: collectionAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: CORE_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data: data
    });
    
    const transaction = new Transaction().add(instruction);
    transaction.feePayer = payerKeypair.publicKey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    
    transaction.sign(payerKeypair, assetKeypair);
    
    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction(signature, 'confirmed');
    
    console.log('Minted NFT:', assetKeypair.publicKey.toString(), 'Bug:', bugId);
    
    res.json({
      success: true,
      nftAddress: assetKeypair.publicKey.toString(),
      transaction: signature,
      bugId: bugId,
      name: name
    });

  } catch (error) {
    console.error('Mint failed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/campaign-stats/:campaignId', async (req, res) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    
    const [campaignPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('campaign'), Buffer.from([campaignId])],
      PROGRAM_ID
    );
    
    const accountInfo = await connection.getAccountInfo(campaignPda);
    
    if (!accountInfo) {
      return res.json({
        success: true,
        campaignId: campaignId,
        totalCompletions: 0,
        uniquePlayers: 0
      });
    }
    
    res.json({
      success: true,
      campaignId: campaignId,
      exists: true
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
