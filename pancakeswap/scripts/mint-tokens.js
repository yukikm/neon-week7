const { ethers, network, run } = require('hardhat');
const {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction
} = require('@solana/spl-token');
const { mintNeonTransactionData } = require('@neonevm/token-transfer-ethers');
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
  // await asyncTimeout(5e3);
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
    const amountToMint = 10000;
    const tokenContract = erc20Factory.attach(token.address);
    // await tokenContract.mint(deployer.address, amountToMint);
    await asyncTimeout(2e3);
    // await tokenA.deposit({ value: amountToMint });

    console.log(`tokenContract.balanceOf`, await tokenContract.balanceOf(deployer.address));
    await transferTokenToSolana(connection, solanaWallet, deployer, token, amountToMint);
    await asyncTimeout(2e3);

    const tokenAmount = 10 ** token.decimals;
    const memberWallet = new PublicKey(memberWallets[0]);
    const tokenMint = new PublicKey(token.address_spl);
    const ataFrom = getAssociatedTokenAddressSync(tokenMint, solanaWallet.publicKey);
    const ataTo = getAssociatedTokenAddressSync(tokenMint, memberWallet);
    console.log(`ataFrom`, ataFrom.toBase58(), await connection.getTokenAccountBalance(ataFrom));
    console.log(`ataTo`, ataTo.toBase58(), await connection.getTokenAccountBalance(ataTo));

    let account = await connection.getAccountInfo(ataTo);
    if (!account) {
      const transaction = new Transaction();
      transaction.add(createAssociatedTokenAccountInstruction(solanaWallet.publicKey, ataTo, memberWallet, tokenMint));
      const signature = await sendSolanaTransaction(connection, transaction, [solanaWallet]);
    }
    const transaction = new Transaction();
    transaction.add(createTransferInstruction(ataFrom, ataTo, solanaWallet.publicKey, tokenAmount));
    const signature = await sendSolanaTransaction(connection, transaction, [solanaWallet]);
    console.log(signature);
  }
}

async function transferTokenToSolana(connection, solanaWallet, deployer, token, amount) {
  await createAssociatedTokenAccount(connection, solanaWallet, token);
  const mintAddress = new PublicKey(token.address_spl);
  const tokenAddress = getAssociatedTokenAddressSync(mintAddress, solanaWallet.publicKey);
  const data = mintNeonTransactionData(tokenAddress, token, amount);
  const transaction = createMintNeonTransaction(deployer.address, token, data);
  const feeData = await provider.getFeeData();
  const gasEstimate = await provider.estimateGas(transaction);
  console.log(gasEstimate);
  transaction.gasPrice = feeData.gasPrice;
  transaction.gasLimit = 1e7;
  transaction.nonce = await deployer.getNonce();
  const result = await deployer.sendTransaction(transaction);
  console.log(JSON.stringify(result, null, 2));
  await result.wait();
  console.log(result);
  return result;
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
