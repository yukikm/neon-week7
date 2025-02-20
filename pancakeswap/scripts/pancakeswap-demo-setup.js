const { ethers, network, run } = require('hardhat');
const { deployPancakeswapExchange } = require('./deploy-pancakeswap-exchange');
const { deployERC20ForSPLMintable } = require('./deploy-tokens');
const { createPairAndAddLiquidity } = require('./create-liquidity-pools');
const { airdropNEON, writeToFile } = require('./utils');
require('dotenv').config();

async function main() {
  await run('compile');

  console.log(`\nNetwork name: ${network.name}`);

  if (!process.env.DEPLOYER_KEY) {
    throw new Error('\nMissing private key: DEPLOYER_KEY');
  }

  const deployer = (await ethers.getSigners())[0];
  console.log(`\nDeployer address: ${deployer.address}`);

  let deployerBalance = BigInt(await ethers.provider.getBalance(deployer.address));
  const minBalance = ethers.parseUnits('10000', 18); // 10000 NEON
  if (
    deployerBalance < minBalance &&
    parseInt(ethers.formatUnits((minBalance - deployerBalance).toString(), 18)) > 0
  ) {
    await airdropNEON(deployer.address, parseInt(ethers.formatUnits((minBalance - deployerBalance).toString(), 18)));
    deployerBalance = BigInt(await ethers.provider.getBalance(deployer.address));
  }
  console.log(`\nDeployer balance: ${ethers.formatUnits(deployerBalance.toString(), 18)} NEON`);

  // Deploy Pancakeswap exchnage contracts and WNEON
  const {
    pancakeFactoryAddress,
    pancakeRouterAddress,
    WNEONAddress,
    NEONAddress,
    token
  } = await deployPancakeswapExchange(deployer);

  const mintAuthority = deployer.address; // Set deployer as mint authority

  const wNeon = token;

  // Deploy TOKEN_A (ERC20ForSPLMintable)
  const tokenA = await deployERC20ForSPLMintable(
    'token_A',
    'Token A',
    'TOKEN_A',
    9,
    mintAuthority
  );

  // Deploy TOKEN_B (ERC20ForSPLMintable)
  const tokenB = await deployERC20ForSPLMintable(
    'token_B',
    'Token B',
    'TOKEN_B',
    12,
    mintAuthority
  );

  // Create WNEON-TOKEN_A pair and provide liquidity
  const pairAddressA = await createPairAndAddLiquidity(
    pancakeFactoryAddress,
    pancakeRouterAddress,
    deployer,
    WNEONAddress,
    tokenA.address,
    2000,
    7333
  );

  // Create WNEON-TOKEN_B pair and provide liquidity
  const pairAddressB = await createPairAndAddLiquidity(
    pancakeFactoryAddress,
    pancakeRouterAddress,
    deployer,
    WNEONAddress,
    tokenB.address,
    5300,
    14530
  );

  // Create TOKEN_A-TOKEN_B pair and provide liquidity
  const pairAddressAB = await createPairAndAddLiquidity(
    pancakeFactoryAddress,
    pancakeRouterAddress,
    deployer,
    tokenA.address,
    tokenB.address,
    6345,
    53809
  );

  const result = {
    tokens: [/*wNeon, */tokenA, tokenB],
    swap: {
      neonTokenTransfer: NEONAddress,
      router: pancakeRouterAddress,
      factory: pancakeFactoryAddress,
      pairs: {
        'wneon/token_a': pairAddressA,
        'token_a/wneon': pairAddressA,
        'wneon/token_b': pairAddressB,
        'token_b/wneon': pairAddressB,
        'token_a/token_b': pairAddressAB,
        'token_b/token_a': pairAddressAB
      }
    }
  };

  const json = JSON.stringify(result, null, 2);
  console.log(json);
  writeToFile('addresses.json', json);
  writeToFile('addresses.ts', `export const addresses = ${json}`);
  writeToFile('addresses.js', `const addresses = ${json};\n\nmodule.exports = {addresses};`);

  console.log('\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
