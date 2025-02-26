import { afterEach, beforeAll, describe, it } from '@jest/globals';
import { Connection, Keypair, PublicKey, Signer } from '@solana/web3.js';
import {
  delay,
  getGasToken,
  getProxyState,
  log,
  logJson,
  NeonAddress,
  NeonProxyRpcApi,
  ScheduledTreeAccount,
  SolanaNeonAccount
} from '@neonevm/solana-sign';
import { JsonRpcProvider } from 'ethers';
import { config } from 'dotenv';
import bs58 from 'bs58';
import process from 'node:process';
import { approveSwapAndWithdrawTokensMultiple, swapTokensMultipleV2 } from '../src/api/swap';
import { PancakePair, SwapTokenCommonData, SwapTokensResponse } from '../src/models';
import { sendSolanaTransaction, tokenAccountBalance } from '../src/utils/solana';
import { tokens } from '../src/data/tokens';

config({ path: './tests/.env' });

const { swap, tokensV2, tokensV1 } = tokens(process.env.PROXY_ENV!);


const NEON_API_RPC_SOL_URL = `${process.env.NEON_CORE_API_RPC_URL!}/sol`;
const SOLANA_URL = process.env.SOLANA_URL!;
const SOLANA_WALLET = process.env.SOLANA_WALLET!;

const DURATION = 3e5;
const DELAY = 1e3;

let connection: Connection;
let proxyApi: NeonProxyRpcApi;
let provider: JsonRpcProvider;
let neonEvmProgram: PublicKey;
let chainTokenMint: PublicKey;
let solanaUser: SolanaNeonAccount;
let signer: Signer;
let chainId: number;
const keypair = Keypair.fromSecretKey(bs58.decode(SOLANA_WALLET));

beforeAll(async () => {
  const result = await getProxyState(NEON_API_RPC_SOL_URL);
  connection = new Connection(SOLANA_URL);
  provider = new JsonRpcProvider(NEON_API_RPC_SOL_URL);
  proxyApi = result.proxyApi;
  neonEvmProgram = result.evmProgramAddress;
  const { chainId: chainIdB } = await provider.getNetwork();
  chainId = Number(chainIdB);
  const token = getGasToken(result.tokensList, chainId);
  chainTokenMint = new PublicKey(token.tokenMintAddress);
  solanaUser = SolanaNeonAccount.fromKeypair(keypair, neonEvmProgram, chainTokenMint, chainId);
  signer = solanaUser.signer!;
});

afterEach(async () => {
  await delay(1e3);
});

describe('Check Swap with Solana singer', () => {
  it(`Should Swap tokens v1 (from, to)`, async () => {
    const [_, tokenFrom, tokenTo] = tokensV1;
    const pancakeRouter: NeonAddress = swap.router;
    const pancakePair: PancakePair = swap.pairs[`${tokenFrom.symbol.toLowerCase()}/${tokenTo.symbol.toLowerCase()}`];
    const amountFrom = 0.1;
    const amountTo = 0.2;
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
    const { maxPriorityFeePerGas, maxFeePerGas } = await proxyApi.getMaxFeePerGas();

    const [treeAccountResult, balanceToBefore, balanceToAfter] = await swapTest({
      nonce,
      proxyApi,
      provider,
      connection,
      solanaUser,
      neonEvmProgram,
      pancakePair,
      pancakeRouter,
      amountFrom,
      amountTo,
      tokenFrom,
      tokenTo,
      chainId,
      transactionGas: {
        maxPriorityFeePerGas,
        maxFeePerGas,
        gasLimit: [1e7, 1e7, 1e7, 1e7]
      }
    }, approveSwapAndWithdrawTokensMultiple);
    expect(treeAccountResult?.activeStatus).toBe('Success');
    expect(balanceToAfter).toBeGreaterThan(balanceToBefore);
  });

  it(`Should Swap tokens v1 (to, from)`, async () => {
    const [_, tokenTo, tokenFrom] = tokensV1;
    const pancakeRouter: NeonAddress = swap.router;
    const pancakePair: PancakePair = swap.pairs[`${tokenFrom.symbol.toLowerCase()}/${tokenTo.symbol.toLowerCase()}`];
    const amountFrom = 0.1;
    const amountTo = 0.2;
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
    const { maxPriorityFeePerGas, maxFeePerGas } = await proxyApi.getMaxFeePerGas();

    const [treeAccountResult, balanceToBefore, balanceToAfter] = await swapTest({
      nonce,
      proxyApi,
      provider,
      connection,
      solanaUser,
      neonEvmProgram,
      pancakePair,
      pancakeRouter,
      amountFrom,
      amountTo,
      tokenFrom,
      tokenTo,
      chainId,
      transactionGas: {
        maxPriorityFeePerGas,
        maxFeePerGas,
        gasLimit: [1e7, 1e7, 1e7, 1e7]
      }
    }, approveSwapAndWithdrawTokensMultiple);
    expect(treeAccountResult?.activeStatus).toBe('Success');
    expect(balanceToAfter).toBeGreaterThan(balanceToBefore);
  });

  it(`Should Swap tokens v2 (from, to)`, async () => {
    const [tokenFrom, tokenTo] = tokensV2;
    const pancakeRouter: NeonAddress = swap.router;
    const pancakePair: PancakePair = swap.pairs[`${tokenFrom.symbol.toLowerCase()}/${tokenTo.symbol.toLowerCase()}`];
    const amountFrom = 0.1;
    const amountTo = 0.2;
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
    const { maxPriorityFeePerGas, maxFeePerGas } = await proxyApi.getMaxFeePerGas();

    const [treeAccountResult, balanceToBefore, balanceToAfter] = await swapTest({
      nonce,
      proxyApi,
      provider,
      connection,
      solanaUser,
      neonEvmProgram,
      pancakePair,
      pancakeRouter,
      amountFrom,
      amountTo,
      tokenFrom,
      tokenTo,
      chainId,
      transactionGas: {
        maxPriorityFeePerGas,
        maxFeePerGas,
        gasLimit: [1e7, 1e7, 1e7, 1e7]
      }
    }, swapTokensMultipleV2);
    expect(treeAccountResult?.activeStatus).toBe('Success');
    expect(balanceToAfter).toBeGreaterThan(balanceToBefore);
  });

  it(`Should Swap tokens v2 (to, from)`, async () => {
    const [tokenTo, tokenFrom] = tokensV2;
    const pancakeRouter: NeonAddress = swap.router;
    const pancakePair: PancakePair = swap.pairs[`${tokenFrom.symbol.toLowerCase()}/${tokenTo.symbol.toLowerCase()}`];
    const amountFrom = 0.1;
    const amountTo = 0.2;
    const nonce = Number(await proxyApi.getTransactionCount(solanaUser.neonWallet));
    const { maxPriorityFeePerGas, maxFeePerGas } = await proxyApi.getMaxFeePerGas();

    const [treeAccountResult, balanceToBefore, balanceToAfter] = await swapTest({
      nonce,
      proxyApi,
      provider,
      connection,
      solanaUser,
      neonEvmProgram,
      pancakePair,
      pancakeRouter,
      amountFrom,
      amountTo,
      tokenFrom,
      tokenTo,
      chainId,
      transactionGas: {
        maxPriorityFeePerGas,
        maxFeePerGas,
        gasLimit: [1e7, 1e7, 1e7, 1e7]
      }
    }, swapTokensMultipleV2);
    expect(treeAccountResult?.activeStatus).toBe('Success');
    expect(balanceToAfter).toBeGreaterThan(balanceToBefore);
  });
});

const swapTest = async (params: SwapTokenCommonData, method: (params: SwapTokenCommonData) => Promise<SwapTokensResponse>): Promise<[ScheduledTreeAccount | null, bigint, bigint]> => {
  const {
    nonce,
    proxyApi,
    provider,
    connection,
    solanaUser,
    neonEvmProgram,
    pancakePair,
    pancakeRouter,
    amountFrom,
    amountTo,
    tokenFrom,
    tokenTo,
    chainId,
    transactionGas
  } = params;
  const balanceToBefore = await tokenAccountBalance(connection, solanaUser, tokenTo);
  const { scheduledTransaction, transactions } = await method({
    nonce,
    proxyApi,
    provider,
    connection,
    solanaUser,
    neonEvmProgram,
    pancakePair,
    pancakeRouter,
    amountFrom,
    amountTo,
    tokenFrom,
    tokenTo,
    chainId,
    transactionGas
  });
  await sendSolanaTransaction(connection, scheduledTransaction, [signer]);
  const results = [];
  for (const transaction of transactions) {
    results.push(proxyApi.sendRawScheduledTransaction(`0x${transaction.serialize()}`));
  }
  const resultsHash = await Promise.all(results);
  logJson(resultsHash);

  const start = Date.now();
  let treeAccountResult: ScheduledTreeAccount | null = null;
  while (DURATION > Date.now() - start) {
    const { result } = await proxyApi.getScheduledTreeAccount(solanaUser.neonWallet, nonce);
    log(result);
    treeAccountResult = result!;
    if (result?.activeStatus === 'Success') {
      break;
    }
    await delay(DELAY);
  }
  const balanceToAfter = await tokenAccountBalance(connection, solanaUser, tokenTo);

  return [treeAccountResult, balanceToBefore, balanceToAfter];
};
