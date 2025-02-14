const { existsSync, mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');
const { solanaTransactionLog } = require('@neonevm/token-transfer-core');
const { ethers } = require('hardhat');
const { LAMPORTS_PER_SOL } = require('@solana/web3.js');

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
  console.log('\nAirdropping ' + ethers.formatUnits(amount.toString(), 0) + ' NEON to ' + address);
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
  sendSolanaTransaction,
  transferSolToMemberWallet,
  writeToFile
};
