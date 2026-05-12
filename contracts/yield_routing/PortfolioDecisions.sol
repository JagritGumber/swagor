// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  PortfolioDecisions
 * @notice Minimal event-only anchor contract for AI agent decisions on Arc.
 * @dev    Deploys once via Circle Smart Contract Platform. Indexers and the
 *         dashboard listen to DecisionAnchored events. Full reasoning trace
 *         (graph snapshot + swarm rounds + tax/critic outputs) is pinned to
 *         IPFS; only the hashes and CID land on-chain.
 *
 *         The contract is intentionally permissionless: any caller can anchor
 *         a decision tied to their address as the "portfolio". This keeps
 *         deployment simple and shifts trust to the off-chain attestation
 *         (Supabase rows + IPFS content) rather than on-chain access control.
 */
contract PortfolioDecisions {
    event DecisionAnchored(
        address indexed portfolio,
        bytes32 indexed cycleId,
        bytes32 graphSnapshotHash,
        bytes32 swarmTraceHash,
        string ipfsCid,
        string verdict,
        uint64 anchoredAt
    );

    /**
     * @notice Anchor a single decision cycle's reasoning hashes on Arc.
     * @param cycleId            UUID-bytes32 of the rebalance cycle.
     * @param graphSnapshotHash  SHA-256 of the canonicalized graph snapshot.
     * @param swarmTraceHash     SHA-256 of the canonicalized swarm rounds payload.
     * @param ipfsCid            CID of the pinned full reasoning JSON on IPFS.
     * @param verdict            Critic's final verdict: "approve"|"reject"|"modify".
     */
    function anchorDecision(
        bytes32 cycleId,
        bytes32 graphSnapshotHash,
        bytes32 swarmTraceHash,
        string calldata ipfsCid,
        string calldata verdict
    ) external {
        emit DecisionAnchored(
            msg.sender,
            cycleId,
            graphSnapshotHash,
            swarmTraceHash,
            ipfsCid,
            verdict,
            uint64(block.timestamp)
        );
    }
}
