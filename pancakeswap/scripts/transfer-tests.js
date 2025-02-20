const { ethers } = require('hardhat');
const { createApproveInstruction, getAssociatedTokenAddressSync } = require('@solana/spl-token');
const { PublicKey } = require('@solana/web3.js');
const {
  createScheduledNeonEvmMultipleTransaction,
  getGasToken,
  getProxyState,
  MultipleTransactions,
  NO_CHILD_INDEX,
  ScheduledTransaction,
  SolanaNeonAccount
} = require('@neonevm/solana-sign');
const {
  authAccountAddress,
  solanaNEONTransferTransaction,
  signerPrivateKey,
  NeonProxyRpcApi,
  erc20Abi
} = require('@neonevm/token-transfer-core');
const { neonTransferMintTransactionEthers } = require('@neonevm/token-transfer-ethers');
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
const {
  asyncTimeout,
  sendSolanaTransaction,
  transferSolToMemberWallet,
  transferERC20TokenToBankAccount,
  transferTokenToMemberWallet
} = require('./utils');
const { addresses } = require('../artifacts/addresses');

require('dotenv').config();

async function transferTokensFromSolanaToNeon(tokens, address, amount) {
  const solanaUrl = process.env.SOLANA_RPC_NODE;
  const connection = new Connection(solanaUrl);
  const solanaWallet = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_WALLET));
  const result = await getProxyState(process.env.NEON_EVM_NODE);
  const { chainId: chainIdB } = await ethers.provider.getNetwork();
  const chainId = Number(chainIdB);
  const neonEvmProgram = result.evmProgramAddress;

  for (const token of tokens) {
    if (['wNEON', 'NEON'].includes(token.symbol)) {
      const neonTokenMint = new PublicKey(token.address_spl);
      const transaction = await solanaNEONTransferTransaction({
        solanaWallet: solanaWallet.publicKey,
        neonWallet: address,
        neonEvmProgram,
        neonTokenMint,
        token: token,
        amount,
        chainId: chainId
      });
      await sendSolanaTransaction(connection, transaction, [solanaWallet]);
    } else {
      const solanaWalletSigner = new ethers.Wallet(signerPrivateKey(solanaWallet.publicKey, address), ethers.provider);
      const neonProxyApi = new NeonProxyRpcApi(process.env.NEON_EVM_NODE);
      for (const token of tokens) {
        const transaction = await neonTransferMintTransactionEthers({
          connection,
          proxyApi: neonProxyApi,
          neonEvmProgram,
          solanaWallet: solanaWallet.publicKey,
          neonWallet: address,
          walletSigner: solanaWalletSigner,
          splToken: token,
          amount,
          chainId
        });

        await sendSolanaTransaction(connection, transaction, [solanaWallet]);
      }
      await asyncTimeout(5e3);
    }
  }
}

function claimToScheduledTransaction(index, data) {
  const {
    solanaUser,
    token,
    chainId,
    amount,
    nonce,
    neonEvmProgram,
    transactionGas
  } = data;

  const fullAmount = ethers.parseUnits(amount.toString(), token.decimals);
  const tokenATA = getAssociatedTokenAddressSync(new PublicKey(token.address_spl), solanaUser.publicKey);
  const climeData = new ethers.Interface(erc20Abi).encodeFunctionData('claimTo', [tokenATA.toBuffer(), solanaUser.neonWallet, fullAmount]);

  const transaction = new ScheduledTransaction({
    index: index,
    nonce: nonce,
    payer: solanaUser.neonWallet,
    target: token.address,
    callData: climeData,
    chainId: chainId,
    gasLimit: transactionGas.gasLimit[0],
    maxFeePerGas: transactionGas.maxFeePerGas,
    maxPriorityFeePerGas: transactionGas.maxPriorityFeePerGas
  });

  const [delegatePDA] = authAccountAddress(solanaUser.neonWallet, neonEvmProgram, token);
  const approve = createApproveInstruction(tokenATA, delegatePDA, solanaUser.publicKey, fullAmount);
  return [transaction, approve];
}

async function transferTokensToSolanaNative(connection, solanaWallet, amount) {
  const result = await getProxyState(process.env.NEON_EVM_NODE);
  const proxyApi = result.proxyApi;
  const { chainId: chainIdB } = await ethers.provider.getNetwork();
  const chainId = Number(chainIdB);
  const token = getGasToken(result.tokensList, chainId);
  const tokenMint = new PublicKey(token.tokenMintAddress);
  const neonEvmProgram = result.evmProgramAddress;
  const solanaUser = SolanaNeonAccount.fromKeypair(solanaWallet, result.evmProgramAddress, tokenMint, chainId);
  for (const token of addresses.tokens) {
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
    const { maxPriorityFeePerGas, maxFeePerGas } = await proxyApi.getMaxFeePerGas();
    const multiple = new MultipleTransactions(nonce, maxFeePerGas, maxPriorityFeePerGas);
    const transactions = [];

    const [claimTransaction, approveInstruction] = claimToScheduledTransaction(0, {
      solanaUser,
      token,
      chainId,
      amount,
      nonce,
      neonEvmProgram,
      transactionGas: { gasLimit: [1e7], maxPriorityFeePerGas, maxFeePerGas }
    });

    // Approve clime to trx
    multiple.addTransaction(claimTransaction, NO_CHILD_INDEX, 0);
    transactions.push(claimTransaction);

    // [1] scheduled trxs
    const scheduledTransaction = createScheduledNeonEvmMultipleTransaction({
      chainId: chainId,
      neonEvmProgram: neonEvmProgram,
      neonTransaction: multiple.data,
      signerAddress: solanaUser.publicKey,
      tokenMintAddress: solanaUser.tokenMint,
      neonWallet: solanaUser.neonWallet,
      neonWalletNonce: nonce
    });

    // [0] approve
    scheduledTransaction.instructions.unshift(approveInstruction);

    await sendSolanaTransaction(connection, scheduledTransaction, [solanaWallet]);

    const response = await proxyApi.waitTransactionByHash(signature, 2e3);
    console.log(response);
    await asyncTimeout(5e3);
  }
}

async function wrappingSol() {
  const solanaUrl = process.env.SOLANA_RPC_NODE;
  const connection = new Connection(solanaUrl);
  const solanaWallet = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_WALLET));
  await transferSolToMemberWallet(connection, solanaWallet.publicKey, 100);

  const ata = await getAssociatedTokenAddress(
    NATIVE_MINT, // mint
    solanaWallet.publicKey // owner
  );

  const amount = LAMPORTS_PER_SOL; /* Wrapped SOL's decimals is 9 */

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

async function mintAndTransferTokensOnDevnet(tokens) {
  const solanaUrl = process.env.SOLANA_RPC_NODE;
  const connection = new Connection(solanaUrl);
  const solanaWallet = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_WALLET));
  const deployer = (await ethers.getSigners())[0];
  const contract = 'contracts/erc20-for-spl-v2/token/ERC20ForSpl/erc20_for_spl.sol:ERC20ForSplMintable';
  const memberWallet = new PublicKey(`3KKCLD3UCnzstxDisVmfFTp7iVSc7FoLwJxWfZk5cWCu`);

  const ERC20ForSPLMintableContractFactory = await ethers.getContractFactory(contract);
  for (const tokenKey of tokens) {
    const amount = 10000;
    const tokenContract = ERC20ForSPLMintableContractFactory.attach(tokenKey);
    const tokenName = await tokenContract.name();
    const tokenSymbol = await tokenContract.symbol();
    const tokenDecimals = await tokenContract.decimals();
    const tokenMint = await tokenContract.tokenMint();
    const address_spl = bs58.encode(ethers.getBytes(tokenMint));
    console.log(`Token address: ${tokenKey}`);
    console.log(`Token spl address: ${address_spl}`);
    console.log(`Token name: ${tokenName}`);
    console.log(`Token symbol: ${tokenSymbol}`);
    console.log(`Token decimals: ${tokenDecimals}`);

    const token = {
      address: tokenKey,
      address_spl: address_spl,
      name: tokenName,
      symbol: tokenSymbol,
      decimals: tokenDecimals
    };

    let balance = await tokenContract.balanceOf(deployer.address);
    if (balance < amount) {
      let amountToMint = BigInt(amount) - BigInt(balance);
      await tokenContract.mint(deployer.address, amountToMint);

      await asyncTimeout(3000);
      console.log(`Minted ${ethers.formatUnits(amountToMint.toString(), tokenDecimals)} ${tokenSymbol} to deployer address ${deployer.address}`);
      balance = await tokenContract.balanceOf(deployer.address);
    }
    console.log(`Deployer ${tokenSymbol} balance: ${ethers.formatUnits(balance.toString(), tokenDecimals)}`);
    await transferERC20TokenToBankAccount(connection, solanaWallet, deployer, token, amount, contract);
    await transferTokenToMemberWallet(connection, solanaWallet, memberWallet, token, 100);
  }
}

async function main() {
  const tokens = [
    `0xD6AE78Fd3E022AC6Bbc0fab385B4CD5924c480f7`,
    `0x165D4788242D98786a1db0dA79953d35702eADEd`
  ];

  await mintAndTransferTokensOnDevnet(tokens);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
