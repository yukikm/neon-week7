const { ethers, network } = require('hardhat');
const {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction
} = require('@solana/spl-token');
const { erc20ForSPLContract } = require('@neonevm/token-transfer-ethers');
const { createMintNeonTransaction } = require('@neonevm/token-transfer-core');
const {
  Connection,
  PublicKey,
  Keypair,
  Transaction, LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const { default: bs58 } = require('bs58');
const { createAssociatedTokenAccount, asyncTimeout, sendSolanaTransaction } = require('./utils');
const { addresses } = require('../artifacts/addresses');
const { JsonRpcProvider } = require('ethers');
require('dotenv').config();

const provider = new JsonRpcProvider(process.env.NEON_EVM_NODE);

async function main() {
  console.log('\nNetwork name: ' + network.name);
  const solanaUrl = process.env.SOLANA_RPC_NODE;
  const connection = new Connection(solanaUrl);
  const solanaWallet = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_WALLET));

  await connection.requestAirdrop(solanaWallet.publicKey, 1e9);
  await asyncTimeout(5e3);
  console.log(await connection.getBalance(solanaWallet.publicKey));

  const deployer = (await ethers.getSigners())[0];
  console.log(`Deployer address: ${deployer.address}`);

  const memberWallets = [
    `597t2sa4xA5nmpksr4By176PDeCgwjiTfsFCymxq1pyY`,
    `9MixdkmJUX6tDqPi51u4UuK1QgYVSXZZXnfdv6KhWQDL`,
    `BeLYBoBfsiRfcDu8aRTcrscR4r8byXFjY4keKjp2JDUW`,
    `2uiFt7tpJFkK8PUTmZt4waWouhTd2hPeiLJpJuv4qt9N`,
    `ES5k14ELsh6wPrFGJ1c3GYBC8WS9vQkfHbvaCN5AM4nS`
  ];

  const erc20Factory = await ethers.getContractFactory('ERC20ForSplMintable');
  const wNeonFactory = await ethers.getContractFactory('WNEON');
  for (const token of addresses.tokens) {
    const amount = 10000;
    const amountToMint = ethers.parseUnits(amount.toString(), token.decimals);
    const tokenContract = erc20Factory.attach(token.address);
    // await tokenA.deposit({ value: amountToMint });

    const tokenMint = new PublicKey(token.address_spl);
    const ataSolanaWallet = getAssociatedTokenAddressSync(tokenMint, solanaWallet.publicKey);
    const { value } = await connection.getTokenAccountBalance(ataSolanaWallet);
    if (amountToMint > BigInt(value.amount)) {
      const balance = await tokenContract.balanceOf(deployer.address);
      if (amount > balance) {
        await tokenContract.mint(deployer.address, amountToMint);
        await asyncTimeout(5e3);
      }
      await transferTokenToBankAccount(connection, solanaWallet, deployer, token, amountToMint);
    }
    for (const wallet of memberWallets) {
      const memberWallet = new PublicKey(wallet);
      const balance = await connection.getBalance(solanaWallet.publicKey);
      const airdrop = 10e9;
      if (airdrop > balance) {
        await connection.requestAirdrop(solanaWallet.publicKey, 10e9);
        await asyncTimeout(5e3);
        const balance = await connection.getBalance(solanaWallet.publicKey);
        console.log(`Member wallet: ${memberWallet}; ${balance / LAMPORTS_PER_SOL} SOL`);
      }

      await transferTokenToMemberWallet(connection, solanaWallet, memberWallet, token, 100);
      await asyncTimeout(2e3);
    }
  }
}

async function transferTokenToMemberWallet(connection, solanaWallet, memberWallet, token, amount) {
  const tokenAmount = ethers.parseUnits(amount.toString(), token.decimals);
  const tokenMint = new PublicKey(token.address_spl);
  const ataSolanaWallet = getAssociatedTokenAddressSync(tokenMint, solanaWallet.publicKey);
  console.log(`Token Account: ${ataSolanaWallet.toBase58()}`);
  console.log(`Balance`, await connection.getTokenAccountBalance(ataSolanaWallet));

  const ataMemberWallet = getAssociatedTokenAddressSync(tokenMint, memberWallet);
  const account = await connection.getAccountInfo(ataMemberWallet);
  if (!account) {
    const transaction = new Transaction();
    transaction.add(createAssociatedTokenAccountInstruction(solanaWallet.publicKey, ataMemberWallet, memberWallet, tokenMint));
    await sendSolanaTransaction(connection, transaction, [solanaWallet]);
    await asyncTimeout(10e3);
  }
  const transaction = new Transaction();
  transaction.add(createTransferInstruction(ataSolanaWallet, ataMemberWallet, solanaWallet.publicKey, tokenAmount));
  const signature = await sendSolanaTransaction(connection, transaction, [solanaWallet]);
  console.log(signature);
  await asyncTimeout(2e3);
  console.log(`Token Account: ${ataMemberWallet.toBase58()}`);
  console.log(`Balance`, await connection.getTokenAccountBalance(ataMemberWallet));
}

async function transferTokenToBankAccount(connection, solanaWallet, deployer, token, amount) {
  try {
    const tokenMint = new PublicKey(token.address_spl);
    const ataSolanaWallet = getAssociatedTokenAddressSync(tokenMint, solanaWallet.publicKey);
    let account = await connection.getAccountInfo(ataSolanaWallet);
    if (!account) {
      const transaction = new Transaction();
      transaction.add(createAssociatedTokenAccountInstruction(solanaWallet.publicKey, ataSolanaWallet, solanaWallet.publicKey, tokenMint));
      await sendSolanaTransaction(connection, transaction, [solanaWallet]);
      await asyncTimeout(10e3);
    }
    const transferSolanaData = erc20ForSPLContract().encodeFunctionData('transferSolana', [ataSolanaWallet.toBuffer(), amount]);
    const transaction = createMintNeonTransaction(deployer.address, token, transferSolanaData);
    const feeData = await provider.getFeeData();
    transaction.gasPrice = feeData.gasPrice;
    transaction.gasLimit = 1e7;
    transaction.nonce = await deployer.getNonce();
    const result = await deployer.sendTransaction(transaction);
    console.log(JSON.stringify(result, null, 2));
    await result.wait(1e3);
    await asyncTimeout(3e3);
    return result;
  } catch (e) {
    console.log(e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
