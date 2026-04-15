// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

/// @title SwarmPlan
/// @notice Billing contract for SwarmBrowser. Accepts USDC, emits PlanPurchased.
/// @dev Tier 1 = Pro ($20/mo = 20_000_000 @ 6dp). Tier 2 = Business ($100/mo = 100_000_000).
contract SwarmPlan {
    IERC20 public immutable usdc;
    address public owner;
    address public treasury;

    uint256 public constant PRO_PRICE = 20_000_000;       // $20 at 6 decimals
    uint256 public constant BUSINESS_PRICE = 100_000_000; // $100 at 6 decimals
    uint256 public constant PERIOD = 30 days;

    event PlanPurchased(
        bytes32 indexed keyHash,
        uint8 tier,
        address indexed payer,
        uint256 amountPaid,
        uint256 expiresAt
    );

    constructor(address _usdc, address _treasury) {
        usdc = IERC20(_usdc);
        treasury = _treasury;
        owner = msg.sender;
    }

    /// @notice Purchase a plan. Caller must have approved USDC transfer.
    /// @param keyHash sha256(API key) — opaque identifier the backend indexes.
    /// @param tier 1 = Pro, 2 = Business.
    function purchase(bytes32 keyHash, uint8 tier) external {
        require(tier == 1 || tier == 2, "bad tier");
        uint256 price = tier == 1 ? PRO_PRICE : BUSINESS_PRICE;
        require(usdc.transferFrom(msg.sender, treasury, price), "usdc transfer failed");
        emit PlanPurchased(keyHash, tier, msg.sender, price, block.timestamp + PERIOD);
    }

    function setTreasury(address _t) external {
        require(msg.sender == owner, "not owner");
        treasury = _t;
    }
}
