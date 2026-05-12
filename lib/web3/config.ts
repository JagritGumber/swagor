import { createConfig, http } from "wagmi";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";
import { arcTestnet } from "./chains";

/**
 * Wagmi config. Explicit connector list, NOT `getDefaultConfig` from
 * ConnectKit, because ConnectKit's defaults pull in `@aave/account`
 * which crashes at runtime on chains where Aave isn't deployed.
 *
 * Connectors included:
 *  - injected: MetaMask, Rabby, Brave Wallet, OKX, etc. (window.ethereum)
 *  - coinbaseWallet: Coinbase Wallet extension + mobile
 *  - walletConnect: only loaded if NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set
 *
 * Get a WalletConnect project ID from https://cloud.reown.com if you want
 * mobile wallet support. Otherwise injected + Coinbase covers the desktop case.
 */
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: "Swagora" }),
    ...(wcProjectId
      ? [walletConnect({ projectId: wcProjectId, showQrModal: false })]
      : []),
  ],
  transports: {
    [arcTestnet.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
