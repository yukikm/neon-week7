const { ethers, network } = require('hardhat');
const { treasuryPoolAddressSync, getProxyState } = require(`@neonevm/solana-sign`);
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { default: bs58 } = require('bs58');
const {
  asyncTimeout,
  transferSolToMemberWallet,
  transferNeonTokenToBankAccount,
  transferERC20TokenToBankAccount,
  transferTokenToMemberWallet, deployerAirdrop
} = require('./utils');
const { addresses } = require('../artifacts/addresses');
require('dotenv').config();

const memberWallets = [
  /********************QA*********************/
  `74ScNgGymddiT8Pq7cSSvozbLxdWoQVKmaN2Rzor9P5a`,
  `Cvy4tJfTJWqEN7QkXaKKmB8sZ2eU7FnWwTVbzWQLLtz4`,
  /*******************DEV*********************/
  `597t2sa4xA5nmpksr4By176PDeCgwjiTfsFCymxq1pyY`,
  `25ZACo5FyJXgs6u2rHi6E2jimbMdvwEy2gvvBVuG7J5x`,
  `2uiFt7tpJFkK8PUTmZt4waWouhTd2hPeiLJpJuv4qt9N`,
  /*****************PRODUCT******************/
  `9MixdkmJUX6tDqPi51u4UuK1QgYVSXZZXnfdv6KhWQDL`,
  `BeLYBoBfsiRfcDu8aRTcrscR4r8byXFjY4keKjp2JDUW`,
  `ES5k14ELsh6wPrFGJ1c3GYBC8WS9vQkfHbvaCN5AM4nS`
];

async function main() {
  console.log(`Network name: ${network.name}`);
  const solanaUrl = process.env.SOLANA_RPC_NODE;
  const connection = new Connection(solanaUrl);
  const solanaWallet = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_WALLET));
  await transferSolToMemberWallet(connection, solanaWallet.publicKey, 1);
  const contractV1 = 'contracts/erc20-for-spl/ERC20ForSPL.sol:ERC20ForSplMintable';
  const contractV2 = 'contracts/erc20-for-spl-v2/token/ERC20ForSpl/erc20_for_spl.sol:ERC20ForSplMintable';

  await createPoolDeposit(connection);

  const deployer = (await ethers.getSigners())[0];
  await deployerAirdrop(deployer, 10000);

  for (const token of addresses.tokensV1) {
    if (token.symbol === 'wNEON') {
      await transferNeonTokenToBankAccount(connection, solanaWallet, deployer, token, 1000, addresses.swap.neonTokenTransfer);
    } else {
      await transferERC20TokenToBankAccount(connection, solanaWallet, deployer, token, 10000, contractV1);
    }
    for (const wallet of memberWallets) {
      const memberWallet = new PublicKey(wallet);
      await transferSolToMemberWallet(connection, memberWallet, 10);
      await transferTokenToMemberWallet(connection, solanaWallet, memberWallet, token, 100);
      await asyncTimeout(2e3);
    }
  }

  for (const token of addresses.tokensV2) {
    await transferERC20TokenToBankAccount(connection, solanaWallet, deployer, token, 10000, contractV2);
    for (const wallet of memberWallets) {
      const memberWallet = new PublicKey(wallet);
      await transferTokenToMemberWallet(connection, solanaWallet, memberWallet, token, 100);
    }
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
