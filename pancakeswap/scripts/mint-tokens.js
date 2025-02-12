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
  Transaction
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

  // const tokenAAddress = `0xC3529Db933f3D28323CD825c666CBBAf5BDbF7f8`;
  // const tokenBAddress = `0x0503Be7119b775BFC519c4F489C8D52521fEA207`;
  const erc20Factory = await ethers.getContractFactory('ERC20ForSplMintable');
  const wNeonFactory = await ethers.getContractFactory('WNEON');
  // const tokensKeys = [tokenAAddress, tokenBAddress];
  for (const token of addresses.tokens) {
    const amount = 10000;
    const amountToMint = ethers.parseUnits(amount.toString(), token.decimals);
    const tokenContract = erc20Factory.attach(token.address);
    await tokenContract.mint(deployer.address, amountToMint);
    await asyncTimeout(2e3);
    // await tokenA.deposit({ value: amountToMint });

    console.log(`tokenContract.balanceOf`, await tokenContract.balanceOf(deployer.address));
    await transferTokenToBankAccount(connection, solanaWallet, deployer, token, amountToMint);
    for (const memberWallet of memberWallets) {
      await transferTokenToMemberWallet(connection, solanaWallet, memberWallet, token, 100);
      await asyncTimeout(2e3);
    }
  }
}

async function transferTokenToMemberWallet(connection, solanaWallet, memberWallet, token, amount) {
  const tokenAmount = ethers.parseUnits(amount.toString(), token.decimals);
  const tokenMint = new PublicKey(token.address_spl);
  const ataFrom = getAssociatedTokenAddressSync(tokenMint, solanaWallet.publicKey);
  console.log(`Token Account: ${ataFrom.toBase58()}`);
  console.log(`Balance`, await connection.getTokenAccountBalance(ataFrom));

  const ataTo = getAssociatedTokenAddressSync(tokenMint, memberWallet);
  const account = await connection.getAccountInfo(ataTo);
  if (!account) {
    const transaction = new Transaction();
    transaction.add(createAssociatedTokenAccountInstruction(solanaWallet.publicKey, ataTo, memberWallet, tokenMint));
    await sendSolanaTransaction(connection, transaction, [solanaWallet]);
    await asyncTimeout(10e3);
  }
  const transaction = new Transaction();
  transaction.add(createTransferInstruction(ataFrom, ataTo, solanaWallet.publicKey, tokenAmount));
  const signature = await sendSolanaTransaction(connection, transaction, [solanaWallet]);
  console.log(signature);
  await asyncTimeout(2e3);
  console.log(`Token Account: ${ataTo.toBase58()}`);
  console.log(`Balance`, await connection.getTokenAccountBalance(ataTo));
}

async function transferTokenToBankAccount(connection, solanaWallet, deployer, token, amount) {
  await createAssociatedTokenAccount(connection, solanaWallet, token);
  const mintAddress = new PublicKey(token.address_spl);
  const tokenAddress = getAssociatedTokenAddressSync(mintAddress, solanaWallet.publicKey);
  const transferSolanaData = erc20ForSPLContract().encodeFunctionData('transferSolana', [tokenAddress.toBuffer(), amount]);
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
