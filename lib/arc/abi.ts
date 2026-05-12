/**
 * ABI for contracts/yield_routing/PortfolioDecisions.sol.
 * Kept in sync manually with the .sol source.
 */
export const PORTFOLIO_DECISIONS_ABI = [
  {
    type: "event",
    name: "DecisionAnchored",
    inputs: [
      { name: "portfolio", type: "address", indexed: true, internalType: "address" },
      { name: "cycleId", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "graphSnapshotHash", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "swarmTraceHash", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "ipfsCid", type: "string", indexed: false, internalType: "string" },
      { name: "verdict", type: "string", indexed: false, internalType: "string" },
      { name: "anchoredAt", type: "uint64", indexed: false, internalType: "uint64" },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "anchorDecision",
    inputs: [
      { name: "cycleId", type: "bytes32", internalType: "bytes32" },
      { name: "graphSnapshotHash", type: "bytes32", internalType: "bytes32" },
      { name: "swarmTraceHash", type: "bytes32", internalType: "bytes32" },
      { name: "ipfsCid", type: "string", internalType: "string" },
      { name: "verdict", type: "string", internalType: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
