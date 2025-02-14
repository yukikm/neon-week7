const { ethers, network, run } = require('hardhat');

const {
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
  NATIVE_MINT
} = require('@solana/spl-token');
const {
  Keypair,
  Transaction,
  SystemProgram,
  Connection,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const { default: bs58 } = require('bs58');
const { sendSolanaTransaction, transferSolToMemberWallet } = require('./utils');
const { transferNeonTokenToBankAccount } = require('./mint-tokens');

require('dotenv').config();

async function main() {
  await run('compile');
  console.log(`Network name: ${network.name}`);

  const neonTokenContract = await ethers.getContractFactory('NeonToken');
  const neonToken = await neonTokenContract.deploy();
  await neonToken.waitForDeployment();
  const neonTransferAddress = neonToken.target;
  console.log(`neonTransferAddress`, neonTransferAddress);

  const solanaUrl = process.env.SOLANA_RPC_NODE;
  const connection = new Connection(solanaUrl);
  const solanaWallet = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_WALLET));

  const deployer = (await ethers.getSigners())[0];
  console.log(`Deployer address: ${deployer.address}`);

  const token = {
    address: '0x3b797f94F7C49B58D7d6b67b8bDB33331d8569d3',
    address_spl: 'HPsV9Deocecw3GeZv1FkAPNCBRfuVyfw9MMwjwRe1xaU',
    name: 'Wrapped NEON',
    symbol: 'wNEON',
    decimals: 18
  };

  await transferNeonTokenToBankAccount(connection, solanaWallet, deployer, token, 10000, neonTransferAddress);
}

async function _main() {
  const solanaUrl = process.env.SOLANA_RPC_NODE;
  const connection = new Connection(solanaUrl);
  const solanaWallet = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_WALLET));
  await transferSolToMemberWallet(connection, solanaWallet.publicKey, 100);

  const ata = await getAssociatedTokenAddress(
    NATIVE_MINT, // mint
    solanaWallet.publicKey // owner
  );

  const amount = LAMPORTS_PER_SOL; /* Wrapped SOL's decimals is 9 */

  console.log(ata);

  const transaction = new Transaction().add(
    // createAssociatedTokenAccountInstruction(solanaWallet.publicKey, ata, solanaWallet.publicKey, NATIVE_MINT),
    SystemProgram.transfer({
      fromPubkey: solanaWallet.publicKey,
      toPubkey: ata,
      lamports: amount
    }),
    createSyncNativeInstruction(ata));

  await sendSolanaTransaction(connection, transaction, [solanaWallet]);
}

main();
