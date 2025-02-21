const { existsSync, mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');
const { ethers } = require('hardhat');
const { Big } = require('big.js');
const { solanaTransactionLog,
  wrappedNeonTransaction,
  neonNeonTransaction,
  createMintNeonTransaction
} = require('@neonevm/token-transfer-core');
const { LAMPORTS_PER_SOL, Transaction, PublicKey } = require('@solana/web3.js');
const { createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createTransferInstruction
} = require('@solana/spl-token');
const {
  neonWrapper2Contract,
  neonWrapperContract,
  erc20ForSPLContract
} = require('@neonevm/token-transfer-ethers');

const provider = new ethers.JsonRpcProvider(process.env.NEON_EVM_NODE);

async function asyncTimeout(timeout) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), timeout);
  });
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

async function airdropNEON(address, amount) {
  const postRequestNeons = await fetch(process.env.NEON_FAUCET, {
    method: 'POST',
    body: JSON.stringify({ 'amount': amount, 'wallet': address }),
    headers: { 'Content-Type': 'application/json' }
  });
  console.log(`\nAirdropping ${ethers.formatUnits(amount.toString(), 0)} NEON to ${address}`);
  await asyncTimeout(3000);
}

async function sendSolanaTransaction(connection, transaction, signers, confirm = false, options) {
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.sign(...signers);
  solanaTransactionLog(transaction);
  const signature = await connection.sendRawTransaction(transaction.serialize(), options);
  if (confirm) {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
  }
  console.log(`https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${process.env.SOLANA_RPC_NODE}`);
  return signature;
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

async function transferTokenToMemberWallet(connection, solanaWallet, memberWallet, token, amount) {
  const tokenAmount = ethers.parseUnits(amount.toString(), token.symbol === 'wNEON' ? 9 : token.decimals);
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

async function transferNeonTokenToBankAccount(connection, solanaWallet, deployer, token, amount, neonTransferAddress) {
  const wNeonFactory = await ethers.getContractFactory('WNEON');
  const fullAmount = ethers.parseUnits(amount.toString(), token.decimals);
  const tokenContract = wNeonFactory.attach(token.address);
  const tokenMint = new PublicKey(token.address_spl);
  const ataSolanaWallet = getAssociatedTokenAddressSync(tokenMint, solanaWallet.publicKey);
  await createAssociatedTokenAccount(connection, solanaWallet, solanaWallet.publicKey, ataSolanaWallet, tokenMint);
  const { value } = await connection.getTokenAccountBalance(ataSolanaWallet);
  console.log(`Token Account: ${ataSolanaWallet.toBase58()}`);
  console.log(`Balance: ${value.uiAmountString} ${token.symbol}`);
  if (ethers.parseUnits(amount.toString(), 9) > BigInt(value.amount)) {
    const balance = await tokenContract.balanceOf(deployer.address);
    console.log(fullAmount, balance);
    if (fullAmount > balance) {
      console.log(`Mint ${amount} ${token.symbol}`);
      // await tokenContract.mint(deployer.address, fullAmount);
      await tokenContract.deposit({ value: fullAmount });
      await asyncTimeout(5e3);
      const balance = await tokenContract.balanceOf(deployer.address);
      console.log(`Deployer ${deployer.address}`);
      console.log(`Balance ${new Big(balance.toString()).div(10 ** 18).toString()} ${token.symbol}`);
    }
    try {
      console.log(`Transfer ${amount} ${token.symbol} to ${solanaWallet.publicKey.toBase58()} wallet`);

      {
        console.log(`Unwrap wNEON to NEON in ${deployer.address} wallet`);
        const data = neonWrapper2Contract().encodeFunctionData('withdraw', [ethers.parseUnits(amount.toString(), token.decimals)]);
        const transaction = wrappedNeonTransaction(deployer.address, token.address, data);
        const feeData = await provider.getFeeData();
        transaction.gasPrice = feeData.gasPrice;
        transaction.gasLimit = 1e7;
        transaction.nonce = await deployer.getNonce();
        const result = await deployer.sendTransaction(transaction);
        console.log(`Unwrap transaction: ${JSON.stringify(result, null, 2)}`);
        await result.wait();
      }

      {
        const balance = await ethers.provider.getBalance(deployer.address);
        console.log(`Balance ${new Big(balance.toString()).div(10 ** 18)} ${token.symbol}`);
        const data = neonWrapperContract().encodeFunctionData('withdraw', [solanaWallet.publicKey.toBuffer()]);
        const transaction = neonNeonTransaction(deployer.address, neonTransferAddress, amount, data);
        const feeData = await provider.getFeeData();
        transaction.gasPrice = feeData.gasPrice;
        transaction.gasLimit = 1e7;
        transaction.nonce = await deployer.getNonce();
        const result = await deployer.sendTransaction(transaction);
        console.log(`Transfer transaction:`);
        console.log(JSON.stringify(result, null, 2));
        await result.wait();
      }
      await asyncTimeout(3e3);
      const { value } = await connection.getTokenAccountBalance(ataSolanaWallet);
      console.log(`Token Account: ${ataSolanaWallet.toBase58()}`);
      console.log(`Balance: ${value.uiAmountString} ${token.symbol}`);
    } catch (e) {
      console.log(e);
    }
  }
}

async function transferERC20TokenToBankAccount(connection, solanaWallet, deployer, token, amount, contract = 'ERC20ForSplMintable') {
  const erc20Factory = await ethers.getContractFactory(contract);
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
      const transferSolanaData = erc20ForSPLContract().encodeFunctionData('transferSolana', [ataSolanaWallet.toBuffer(), fullAmount]);
      const transaction = createMintNeonTransaction(deployer.address, token, transferSolanaData);
      const feeData = await provider.getFeeData();
      transaction.gasPrice = feeData.gasPrice;
      transaction.gasLimit = 1e7;
      transaction.nonce = await deployer.getNonce();
      const result = await deployer.sendTransaction(transaction);
      console.log(`Transfer transaction:`);
      console.log(JSON.stringify(result, null, 2));
      await result.wait();
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

async function deployerAirdrop(deployer, amount) {
  console.log(`\nDeployer address: ${deployer.address}`);

  let deployerBalance = BigInt(await ethers.provider.getBalance(deployer.address));
  const minBalance = ethers.parseUnits(amount.toString(), 18); // 10000 NEON
  if (deployerBalance < minBalance && parseInt(ethers.formatUnits((minBalance - deployerBalance).toString(), 18)) > 0) {
    await airdropNEON(deployer.address, parseInt(ethers.formatUnits((minBalance - deployerBalance).toString(), 18)));
    deployerBalance = BigInt(await ethers.provider.getBalance(deployer.address));
  }
  console.log(`\nDeployer balance: ${ethers.formatUnits(deployerBalance.toString(), 18)} NEON`);
}

function writeToFile(fileName, data, distPath = 'artifacts') {
  try {
    const root = process.cwd();
    if (!existsSync(join(root, distPath))) {
      mkdirSync(join(root, distPath));
    }
    writeFileSync(join(root, distPath, fileName), data);
  } catch (e) {
    console.log(e);
  }
}

module.exports = {
  asyncTimeout,
  airdropNEON,
  deployerAirdrop,
  sendSolanaTransaction,
  transferSolToMemberWallet,
  createAssociatedTokenAccount,
  transferTokenToMemberWallet,
  transferNeonTokenToBankAccount,
  transferERC20TokenToBankAccount,
  writeToFile
};
