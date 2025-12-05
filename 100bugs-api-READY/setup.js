const anchor = require('@coral-xyz/anchor');
const { PublicKey, Keypair, SystemProgram, Connection } = require('@solana/web3.js');
const fs = require('fs');
require('dotenv').config();

async function setup() {
  try {
    const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
    
    const walletPrivateKey = JSON.parse(process.env.WALLET_PRIVATE_KEY);
    const walletKeypair = Keypair.fromSecretKey(new Uint8Array(walletPrivateKey));
    
    const balance = await connection.getBalance(walletKeypair.publicKey);
    if (balance === 0) {
      throw new Error('Wallet has no SOL. Run: solana airdrop 2 ' + walletKeypair.publicKey.toString() + ' --url devnet');
    }

    const collectionSecretKey = JSON.parse(process.env.COLLECTION_SECRET_KEY);
    const collectionKeypair = Keypair.fromSecretKey(new Uint8Array(collectionSecretKey));

    const IDL = JSON.parse(fs.readFileSync('./idl.json', 'utf8'));
    
    const wallet = new anchor.Wallet(walletKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    
    // Use explicit PublicKey instead of letting Anchor parse IDL.address
    const programId = new PublicKey('AuXF95nT7WS865AzQpuj3os9r6DjTYY9ekh4mGgG6gfL');
    const program = new anchor.Program(IDL, programId, provider);

    const campaignId = parseInt(process.env.CAMPAIGN_ID || '1');
    
    const [campaignPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('campaign'), Buffer.from([campaignId])],
      program.programId
    );

    try {
      const campaignAccount = await connection.getAccountInfo(campaignPda);
      if (!campaignAccount) {
        const tx1 = await program.methods
          .initialize(campaignId)
          .accounts({
            gameAuthority: walletKeypair.publicKey,
            campaign: campaignPda,
            systemProgram: SystemProgram.programId
          })
          .rpc();
        
        await connection.confirmTransaction(tx1, 'confirmed');
        console.log('Campaign initialized:', tx1);
      } else {
        console.log('Campaign already exists');
      }
    } catch (error) {
      if (!error.message.includes('already in use')) {
        throw error;
      }
    }

    const [collectionAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('collection'), collectionKeypair.publicKey.toBuffer()],
      program.programId
    );

    const CORE_PROGRAM_ID = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');

    try {
      const collectionAccount = await connection.getAccountInfo(collectionKeypair.publicKey);
      if (!collectionAccount) {
        const tx2 = await program.methods
          .createCollection(campaignId, {
            name: "100 Bugs Campaign",
            uri: "ipfs://bafkreidksax7r3inqjpxuaitbhq5h6mhmrd5yp2dvirac6kcixn5h2bc5u",
            nftName: "100 Bugs",
            nftUri: "ipfs://default"
          })
          .accounts({
            creator: walletKeypair.publicKey,
            collection: collectionKeypair.publicKey,
            collectionAuthority: collectionAuthorityPda,
            campaign: campaignPda,
            coreProgram: CORE_PROGRAM_ID,
            systemProgram: SystemProgram.programId
          })
          .signers([collectionKeypair])
          .rpc();
        
        await connection.confirmTransaction(tx2, 'confirmed');
        console.log('Collection created:', tx2);
      } else {
        console.log('Collection already exists');
      }
    } catch (error) {
      if (!error.message.includes('already in use')) {
        throw error;
      }
    }

    console.log('\nSETUP COMPLETE');
    console.log('Campaign PDA:', campaignPda.toString());
    console.log('Collection:', collectionKeypair.publicKey.toString());
    console.log('Collection Authority:', collectionAuthorityPda.toString());

  } catch (error) {
    console.error('SETUP FAILED:', error.message);
    if (error.logs) {
      error.logs.forEach(log => console.error(log));
    }
    process.exit(1);
  }
}

setup();
