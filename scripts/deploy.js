const hre = require("hardhat");

/**
 * Deployment script for QuorumGovernance contract
 * 
 * Configuration options:
 * - QUORUM_BP: Quorum basis points (default: 4000 = 40%)
 * - VOTING_DELAY: Blocks before voting starts (default: 1)
 * - VOTING_PERIOD: Blocks voting is active (default: 100)
 * 
 * Usage:
 * npx hardhat run scripts/deploy.js --network <network-name>
 * 
 * With custom parameters:
 * QUORUM_BP=5000 VOTING_DELAY=10 VOTING_PERIOD=200 npx hardhat run scripts/deploy.js
 */

async function main() {
  console.log("========================================");
  console.log("QuorumGovernance Deployment Script");
  console.log("========================================\n");

  // Get deployment parameters from environment or use defaults
  const quorumBasisPoints = process.env.QUORUM_BP || 4000;
  const votingDelay = process.env.VOTING_DELAY || 1;
  const votingPeriod = process.env.VOTING_PERIOD || 100;

  console.log("Deployment Configuration:");
  console.log(`- Quorum: ${quorumBasisPoints} basis points (${quorumBasisPoints / 100}%)`);
  console.log(`- Voting Delay: ${votingDelay} blocks`);
  console.log(`- Voting Period: ${votingPeriod} blocks`);
  console.log();

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying from account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy contract
  console.log("Deploying QuorumGovernance contract...");
  const QuorumGovernance = await hre.ethers.getContractFactory("QuorumGovernance");
  const governance = await QuorumGovernance.deploy(
    quorumBasisPoints,
    votingDelay,
    votingPeriod
  );

  await governance.waitForDeployment();
  const address = await governance.getAddress();

  console.log("✓ QuorumGovernance deployed to:", address);
  console.log();

  // Verify deployment
  console.log("Verifying deployment...");
  const owner = await governance.owner();
  const quorum = await governance.quorumBasisPoints();
  const delay = await governance.votingDelay();
  const period = await governance.votingPeriod();

  console.log("✓ Owner:", owner);
  console.log("✓ Quorum:", quorum.toString(), "basis points");
  console.log("✓ Voting Delay:", delay.toString(), "blocks");
  console.log("✓ Voting Period:", period.toString(), "blocks");
  console.log();

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: address,
    deployer: deployer.address,
    quorumBasisPoints: quorum.toString(),
    votingDelay: delay.toString(),
    votingPeriod: period.toString(),
    deployedAt: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
  };

  console.log("========================================");
  console.log("Deployment Summary");
  console.log("========================================");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log();

  // Verification instructions
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("To verify on Etherscan, run:");
    console.log(`npx hardhat verify --network ${hre.network.name} ${address} ${quorumBasisPoints} ${votingDelay} ${votingPeriod}`);
    console.log();
  }

  return governance;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

module.exports = { main };
