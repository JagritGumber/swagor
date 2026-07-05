// Network configuration for testnet/mainnet
export const networks = {
  testnet: {
    label: 'Testnet',
    blockchain: 'ARC-TESTNET',
    chainId: 5042002,
    rpc: 'https://rpc.testnet.arc.network',
    explorer: 'https://testnet.arcscan.app',
    hlInfoUrl: 'https://api.hyperliquid-testnet.xyz/info',
    hlWsUrl: 'wss://api.hyperliquid-testnet.xyz/ws',
    faucetEnabled: true,
  },
  mainnet: {
    label: 'Mainnet',
    blockchain: 'ARC-MAINNET',
    chainId: 0,
    rpc: 'https://rpc.arc.network',
    explorer: 'https://arcscan.app',
    hlInfoUrl: 'https://api.hyperliquid.xyz/info',
    hlWsUrl: 'wss://api.hyperliquid.xyz/ws',
    faucetEnabled: false,
  },
} as const

export type Network = keyof typeof networks
