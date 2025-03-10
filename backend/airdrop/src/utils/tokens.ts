import {
  Commitment,
  ConfirmOptions,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError
} from '@solana/spl-token';
import { parseUnits } from 'ethers';
import bs58 from 'bs58';
import { SOLANA_BANK } from '@environment';

const bankWallet = Keypair.fromSecretKey(bs58.decode(SOLANA_BANK));

export async function transferTokens(connection: Connection, wallet: PublicKey, tokenAddress: PublicKey, amount: bigint): Promise<string> {
  const feePayer = wallet;
  const tokenMint = await getMint(connection, tokenAddress);
  const bankTokenAddress = getAssociatedTokenAddressSync(tokenMint.address, bankWallet.publicKey);
  const walletTokenAddress = getAssociatedTokenAddressSync(tokenMint.address, wallet);
  const { blockhash } = await connection.getLatestBlockhash('finalized');
  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: feePayer
  });
  const ataInstruction = await getATAInstruction(connection, feePayer, tokenMint.address, wallet);
  if (ataInstruction) {
    transaction.add(ataInstruction);
  }
  transaction.add(SystemProgram.transfer({
    fromPubkey: wallet,
    toPubkey: bankWallet.publicKey,
    lamports: 5e3
  }));
  transaction.add(createTransferCheckedInstruction(
    bankTokenAddress,
    tokenAddress,
    walletTokenAddress,
    bankWallet.publicKey,
    parseUnits(amount.toString(), tokenMint.decimals),
    tokenMint.decimals
  ));
  transaction.partialSign(bankWallet);
  return bs58.encode(transaction.serialize({ requireAllSignatures: false }));
}

export async function getATAInstruction(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = false,
  commitment?: Commitment,
  confirmOptions?: ConfirmOptions,
  programId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
): Promise<TransactionInstruction | null> {
  const associatedToken = getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve, programId, associatedTokenProgramId);
  try {
    await getAccount(connection, associatedToken, commitment, programId);
  } catch (error: unknown) {
    if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
      return createAssociatedTokenAccountInstruction(payer, associatedToken, owner, mint, programId, associatedTokenProgramId);
    }
  }

  return null;
}
