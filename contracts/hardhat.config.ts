import "dotenv/config";
import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const BASE_MAINNET_RPC_URL = process.env.BASE_MAINNET_RPC_URL;
const ETH_MAINNET_RPC_URL = process.env.ETH_MAINNET_RPC_URL;

const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const config = defineConfig({
  plugins: [hardhatEthers],
  paths: {
    sources: "./src",
  },
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    ethereum: {
      type: "http",
      url: ETH_MAINNET_RPC_URL || "https://ethereum.publicnode.com",
      accounts,
    },
    base: {
      type: "http",
      url: BASE_MAINNET_RPC_URL || "https://mainnet.base.org",
      accounts,
    },
  },
});

export default config;
