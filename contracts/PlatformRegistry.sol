// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

/**
 * @title PlatformRegistry
 * @notice A thin, UI-oriented index for the tokenization platform demo.
 *
 *         The T-REX / OnchainID contracts deliberately do NOT keep
 *         enumerable lists of "every investor onboarded" or "every token
 *         issued on this platform" — that is out of scope for the standard and
 *         would waste gas on-chain. A real platform keeps that index in its own
 *         backend/database.
 *
 *         This PoC has no backend (it is a static single-page app), so we keep
 *         that index on-chain in this small contract. It stores ONLY metadata
 *         needed to render the dashboards (lists of investors and tokens). It
 *         holds no value, enforces no compliance, and is never consulted during
 *         a token transfer — the real gating lives in the T-REX contracts.
 *
 *         Writes are intentionally permissionless: this is a learning demo and
 *         anyone driving the UI may record entries. Do not model production
 *         access control on this contract.
 */
contract PlatformRegistry {
    /// @dev KYC policy chosen by an issuer for a token.
    enum Policy {
        WhitelistCustom, // 0 — only manually selected investors are eligible
        WhitelistAll //     1 — every onboarded investor is eligible (shared IRS)
    }

    struct Investor {
        address wallet; // the investor's funded wallet (token recipient)
        address identity; // their OnchainID identity contract
        uint16 country; // ISO 3166-1 numeric country code
        uint256 onboardedAt; // block timestamp of onboarding
        bool exists;
    }

    struct TokenInfo {
        address token; // the ERC-3643 token address
        address issuer; // the wallet that deployed it
        string name;
        string symbol;
        Policy policy; // KYC policy chosen at issuance
        uint256 issuedAt; // block timestamp of issuance
        bool exists;
    }

    address public immutable deployer;

    address[] private _investorList;
    mapping(address => Investor) public investors;

    address[] private _tokenList;
    mapping(address => TokenInfo) public tokens;

    event InvestorRecorded(address indexed wallet, address indexed identity, uint16 country);
    event TokenRecorded(address indexed token, address indexed issuer, Policy policy);

    constructor() {
        deployer = msg.sender;
    }

    /// @notice Record (or update) an onboarded investor for the UI index.
    function recordInvestor(address wallet, address identity, uint16 country) external {
        require(wallet != address(0) && identity != address(0), "zero address");
        if (!investors[wallet].exists) {
            _investorList.push(wallet);
        }
        investors[wallet] = Investor({
            wallet: wallet,
            identity: identity,
            country: country,
            onboardedAt: block.timestamp,
            exists: true
        });
        emit InvestorRecorded(wallet, identity, country);
    }

    /// @notice Record (or update) a token issued on the platform for the UI index.
    function recordToken(
        address token,
        address issuer,
        string calldata name,
        string calldata symbol,
        Policy policy
    ) external {
        require(token != address(0) && issuer != address(0), "zero address");
        if (!tokens[token].exists) {
            _tokenList.push(token);
        }
        tokens[token] = TokenInfo({
            token: token,
            issuer: issuer,
            name: name,
            symbol: symbol,
            policy: policy,
            issuedAt: block.timestamp,
            exists: true
        });
        emit TokenRecorded(token, issuer, policy);
    }

    // --- Enumeration getters (used by the dashboards) ------------------------

    function getInvestors() external view returns (address[] memory) {
        return _investorList;
    }

    function getTokens() external view returns (address[] memory) {
        return _tokenList;
    }

    function investorCount() external view returns (uint256) {
        return _investorList.length;
    }

    function tokenCount() external view returns (uint256) {
        return _tokenList.length;
    }
}
