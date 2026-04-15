#!/usr/bin/env node
// Deploys SwarmPlan.sol to Demo L2 (chain 845312) via ethers + solc.
// Usage: node deploy-swarmplan.mjs
// Env: DEPLOYER_KEY, USDC_ADDRESS, TREASURY, RPC_URL

import { readFileSync, writeFileSync } from 'node:fs';
import solc from 'solc';
import { ethers } from 'ethers';

const RPC_URL = process.env.RPC_URL || 'https://demo.chainrpc.net';
const DEPLOYER_KEY = process.env.DEPLOYER_KEY || '0x2ff4dfaff9b15374550dada4b630441246b0598de18a8b771ef8e8ad3054a5f4';
const USDC = process.env.USDC_ADDRESS || '0xb081d16D40e4e4c27D6d8564d145Ab2933037111';

const source = readFileSync(new URL('./contracts/SwarmPlan.sol', import.meta.url), 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'SwarmPlan.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors) {
  const fatal = output.errors.filter((e) => e.severity === 'error');
  if (fatal.length) { console.error(fatal); process.exit(1); }
}
const artifact = output.contracts['SwarmPlan.sol']['SwarmPlan'];
const abi = artifact.abi;
const bytecode = '0x' + artifact.evm.bytecode.object;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
const treasury = process.env.TREASURY || wallet.address;

console.log(`Deployer: ${wallet.address}`);
console.log(`Treasury: ${treasury}`);
console.log(`USDC:     ${USDC}`);
console.log(`RPC:      ${RPC_URL}`);

const factory = new ethers.ContractFactory(abi, bytecode, wallet);
const c = await factory.deploy(USDC, treasury);
console.log(`Tx: ${c.deploymentTransaction().hash}`);
await c.waitForDeployment();
const addr = await c.getAddress();
console.log(`SwarmPlan deployed at: ${addr}`);

writeFileSync(new URL('./swarmplan-deployment.json', import.meta.url),
  JSON.stringify({ address: addr, abi, usdc: USDC, treasury, rpc: RPC_URL, chainId: 845312 }, null, 2));
console.log('Wrote swarmplan-deployment.json');
