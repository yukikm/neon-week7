const { ethers, network, run } = require('hardhat');
const { airdropNEON, writeToFile } = require('./utils');
const { createPairAndAddLiquidity } = require('./create-liquidity-pools');
const { deployERC20ForSPLMintable } = require('./deploy-tokens');
const { addresses } = require('../artifacts/addresses');

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

  const mintAuthority = deployer.address; // Set deployer as mint authority
  const contract = 'contracts/erc20-for-spl-v2/token/ERC20ForSpl/erc20_for_spl.sol:ERC20ForSplMintable';

  const tokenAv2 = await deployERC20ForSPLMintable(
    'token_Av2',
    'Token A (v2)',
    'TOKEN_Av2',
    9, // new version have limit of maximum 9 decimals, because Solana don't support more
    mintAuthority,
    contract
  );

  const tokenBv2 = await deployERC20ForSPLMintable(
    'token_Bv2',
    'Token B (v2)',
    'TOKEN_Bv2',
    9, // new version have limit of maximum 9 decimals, because Solana don't support more
    mintAuthority,
    contract
  );

  const pancakeFactoryAddress = addresses.swap.factory;
  const pancakeRouterAddress = addresses.swap.router;

  // Create TOKEN_A-TOKEN_B pair and provide liquidity
  const pairAddressAB = await createPairAndAddLiquidity(
    pancakeFactoryAddress,
    pancakeRouterAddress,
    deployer,
    tokenAv2.address,
    tokenBv2.address,
    30000,
    65000,
    contract
  );

  const a2Symbol = tokenAv2.symbol.toLowerCase();
  const b2Symbol = tokenBv2.symbol.toLowerCase();

  const result = { ...addresses };
  result.tokensV2 = [tokenAv2, tokenBv2];
  result.swap.pairs = {
    ...result.swap.pairs,
    [`${a2Symbol}/${b2Symbol}`]: pairAddressAB,
    [`${b2Symbol}/${a2Symbol}`]: pairAddressAB
  };

  const json = JSON.stringify(result, null, 2);
  console.log(json);
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
