const { ethers, network } = require('hardhat');
const {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction
} = require('@solana/spl-token');
const { erc20ForSPLContract } = require('@neonevm/token-transfer-ethers');
const { createMintNeonTransaction } = require('@neonevm/token-transfer-core');
const { treasuryPoolAddressSync, getProxyState, solanaAirdrop } = require(`@neonevm/solana-sign`);
const {
  Connection,
  PublicKey,
  Keypair,
  Transaction, LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const { default: bs58 } = require('bs58');
const { asyncTimeout, sendSolanaTransaction } = require('./utils');
const { addresses } = require('../artifacts/addresses');
const { JsonRpcProvider } = require('ethers');
require('dotenv').config();

const provider = new JsonRpcProvider(process.env.NEON_EVM_NODE);

const memberWallets = [
  `Cvy4tJfTJWqEN7QkXaKKmB8sZ2eU7FnWwTVbzWQLLtz4`
  `597t2sa4xA5nmpksr4By176PDeCgwjiTfsFCymxq1pyY`,
  `9MixdkmJUX6tDqPi51u4UuK1QgYVSXZZXnfdv6KhWQDL`,
  `BeLYBoBfsiRfcDu8aRTcrscR4r8byXFjY4keKjp2JDUW`,
  `2uiFt7tpJFkK8PUTmZt4waWouhTd2hPeiLJpJuv4qt9N`,
  `ES5k14ELsh6wPrFGJ1c3GYBC8WS9vQkfHbvaCN5AM4nS`
];

async function main() {
  console.log(`Network name: ${network.name}`);
  const solanaUrl = process.env.SOLANA_RPC_NODE;
  const connection = new Connection(solanaUrl);
  const solanaWallet = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_WALLET));
  await transferSolToMemberWallet(connection, solanaWallet.publicKey, 1);

  await createPoolDeposit(connection);

  const deployer = (await ethers.getSigners())[0];
  console.log(`Deployer address: ${deployer.address}`);

  const erc20Factory = await ethers.getContractFactory('ERC20ForSplMintable');
  const wNeonFactory = await ethers.getContractFactory('WNEON');
  for (const token of addresses.tokens) {
    if (token.symbol === 'wNEON') {

    } else {
      await transferERC20TokenToBankAccount(connection, solanaWallet, deployer, token, 10000);
    }
    for (const wallet of memberWallets) {
      const memberWallet = new PublicKey(wallet);
      await transferSolToMemberWallet(connection, memberWallet, 10);
      await transferTokenToMemberWallet(connection, solanaWallet, memberWallet, token, 100);
      await asyncTimeout(2e3);
    }
  }
}

async function transferSolToMemberWallet(connection, memberWallet, amount, delay = 5e3) {
  const fullAmount = amount * LAMPORTS_PER_SOL;
  let balance = await connection.getBalance(memberWallet);
  if (fullAmount > balance) {
    console.log(`Airdrop: ${memberWallet.toBase58()} => ${amount} SOL`);
    await connection.requestAirdrop(memberWallet, fullAmount);
    await asyncTimeout(delay);
    balance = await connection.getBalance(memberWallet);
  }
  console.log(`Wallet balance: ${memberWallet.toBase58()} - ${balance / LAMPORTS_PER_SOL} SOL`);
}

async function transferTokenToMemberWallet(connection, solanaWallet, memberWallet, token, amount) {
  const tokenAmount = ethers.parseUnits(amount.toString(), token.decimals);
  const tokenMint = new PublicKey(token.address_spl);
  const ataSolanaWallet = getAssociatedTokenAddressSync(tokenMint, solanaWallet.publicKey);
  {
    console.log(`Token Account: ${ataSolanaWallet.toBase58()}`);
    const { value } = await connection.getTokenAccountBalance(ataSolanaWallet);
    console.log(`Balance ${value.amount} ${token.symbol}`);
  }

  const ataMemberWallet = getAssociatedTokenAddressSync(tokenMint, memberWallet);
  await createAssociatedTokenAccount(connection, solanaWallet, memberWallet, ataMemberWallet, tokenMint);
  const transaction = new Transaction();
  transaction.add(createTransferInstruction(ataSolanaWallet, ataMemberWallet, solanaWallet.publicKey, tokenAmount));
  const signature = await sendSolanaTransaction(connection, transaction, [solanaWallet]);
  console.log(signature);
  await asyncTimeout(2e3);
  {
    console.log(`Token Account: ${ataMemberWallet.toBase58()}`);
    const { value } = await connection.getTokenAccountBalance(ataMemberWallet);
    console.log(`Balance ${value.amount} ${token.symbol}`);
  }
}

// todo refactoring wneon airdrop
async function transferNeonTokenToBankAccount(connection, solanaWallet, deployer, token, amount) {
  const wNeonFactory = await ethers.getContractFactory('WNEON');
  const fullAmount = ethers.parseUnits(amount.toString(), token.decimals);
  const tokenContract = wNeonFactory.attach(token.address);
  const tokenMint = new PublicKey(token.address_spl);
  const ataSolanaWallet = getAssociatedTokenAddressSync(tokenMint, solanaWallet.publicKey);
  const { value } = await connection.getTokenAccountBalance(ataSolanaWallet);
  console.log(`Token Account: ${ataSolanaWallet.toBase58()}`);
  console.log(`Balance: ${value.uiAmountString} ${token.symbol}`);
  if (fullAmount > BigInt(value.amount)) {
    const balance = await tokenContract.balanceOf(deployer.address);
    if (fullAmount > balance) {
      console.log(`Mint ${amount} ${token.symbol}`);
      // await tokenContract.mint(deployer.address, fullAmount);
      await tokenContract.deposit({ value: fullAmount });
      await asyncTimeout(5e3);
      const balance = await tokenContract.balanceOf(deployer.address);
      console.log(`Deployer ${deployer.address}`);
      console.log(`Balance ${balance} ${token.symbol}`);
    }
    try {
      console.log(`Transfer ${amount} ${token.symbol} to ${solanaWallet.publicKey.toBase58()} wallet`);
      await createAssociatedTokenAccount(connection, solanaWallet, solanaWallet.publicKey, ataSolanaWallet, tokenMint);
      const transferSolanaData = erc20ForSPLContract().encodeFunctionData('transferSolana', [ataSolanaWallet.toBuffer(), fullAmount]);
      const transaction = createMintNeonTransaction(deployer.address, token, transferSolanaData);
      const feeData = await provider.getFeeData();
      transaction.gasPrice = feeData.gasPrice;
      transaction.gasLimit = 1e7;
      transaction.nonce = await deployer.getNonce();
      const result = await deployer.sendTransaction(transaction);
      console.log(`Transfer transaction:`);
      console.log(JSON.stringify(result, null, 2));
      await result.wait(1e3);
      await asyncTimeout(3e3);
      const { value } = await connection.getTokenAccountBalance(ataSolanaWallet);
      console.log(`Token Account: ${ataSolanaWallet.toBase58()}`);
      console.log(`Balance: ${value.uiAmountString} ${token.symbol}`);
      return result;
    } catch (e) {
      console.log(e);
    }
  }
}

async function transferERC20TokenToBankAccount(connection, solanaWallet, deployer, token, amount) {
  const erc20Factory = await ethers.getContractFactory('ERC20ForSplMintable');
  const fullAmount = ethers.parseUnits(amount.toString(), token.decimals);
  const tokenContract = erc20Factory.attach(token.address);
  const tokenMint = new PublicKey(token.address_spl);
  const ataSolanaWallet = getAssociatedTokenAddressSync(tokenMint, solanaWallet.publicKey);
  await createAssociatedTokenAccount(connection, solanaWallet, solanaWallet.publicKey, ataSolanaWallet, tokenMint);
  const { value } = await connection.getTokenAccountBalance(ataSolanaWallet);
  console.log(`Token Account: ${ataSolanaWallet.toBase58()}`);
  console.log(`Balance: ${value.uiAmountString} ${token.symbol}`);
  if (fullAmount > BigInt(value.amount)) {
    const balance = await tokenContract.balanceOf(deployer.address);
    if (fullAmount > balance) {
      console.log(`Mint ${amount} ${token.symbol}`);
      await tokenContract.mint(deployer.address, fullAmount);
      await asyncTimeout(5e3);
    }
    try {
      console.log(`Transfer ${amount} ${token.symbol} to ${solanaWallet.publicKey.toBase58()} wallet`);
      // const tokenMint = new PublicKey(token.address_spl);
      // const ataSolanaWallet = getAssociatedTokenAddressSync(tokenMint, solanaWallet.publicKey);
      const transferSolanaData = erc20ForSPLContract().encodeFunctionData('transferSolana', [ataSolanaWallet.toBuffer(), fullAmount]);
      const transaction = createMintNeonTransaction(deployer.address, token, transferSolanaData);
      const feeData = await provider.getFeeData();
      transaction.gasPrice = feeData.gasPrice;
      transaction.gasLimit = 1e7;
      transaction.nonce = await deployer.getNonce();
      const result = await deployer.sendTransaction(transaction);
      console.log(`Transfer transaction:`);
      console.log(JSON.stringify(result, null, 2));
      await result.wait(1e3);
      await asyncTimeout(3e3);
      const { value } = await connection.getTokenAccountBalance(ataSolanaWallet);
      console.log(`Token Account: ${ataSolanaWallet.toBase58()}`);
      console.log(`Balance: ${value.uiAmountString} ${token.symbol}`);
      return result;
    } catch (e) {
      console.log(e);
    }
  }
}

async function createAssociatedTokenAccount(connection, signer, ownerKey, ataSolanaWallet, tokenMint) {
  let account = await connection.getAccountInfo(ataSolanaWallet);
  if (!account) {
    console.log(`Create ATA for ${ownerKey.toBase58()}`);
    const transaction = new Transaction();
    transaction.add(createAssociatedTokenAccountInstruction(signer.publicKey, ataSolanaWallet, ownerKey, tokenMint));
    await sendSolanaTransaction(connection, transaction, [signer]);
    await asyncTimeout(10e3);
  } else {
    console.log(`Token account (${ataSolanaWallet.toBase58()}) for ${ownerKey.toBase58()} already exist...`);
  }
}

async function createPoolDeposit(connection) {
  const result = await getProxyState(process.env.NEON_EVM_NODE);
  const count = result.proxyStatus.neonTreasuryPoolCount;
  for (let index = 0; index < count; index++) {
    const [publicKey] = treasuryPoolAddressSync(result.evmProgramAddress, index);
    await transferSolToMemberWallet(connection, publicKey, 20, 1e3);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
