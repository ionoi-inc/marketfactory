// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IMarket.sol";

/**
 * @title Market
 * @notice Binary prediction market implementation
 * @dev This contract is meant to be cloned by MarketFactory using EIP-1167
 */
contract Market is IMarket, ReentrancyGuard {
    // ============ Enums ============
    
    enum Outcome {
        No,
        Yes
    }
    
    enum MarketState {
        Active,
        Resolved,
        Cancelled
    }

    // ============ State Variables ============
    
    // Market configuration
    string public question;
    string public description;
    uint256 public endTime;
    address public resolver;
    uint256 public minBet;
    uint256 public maxBet;
    address public factory;
    
    // Market state
    MarketState public state;
    bool public resolvedOutcome;
    uint256 public resolutionTime;
    
    // Trading pools
    uint256 public yesPool;
    uint256 public noPool;
    
    // User positions
    mapping(address => uint256) public yesShares;
    mapping(address => uint256) public noShares;
    mapping(address => bool) public hasClaimed;
    
    // Statistics
    uint256 public totalVolume;
    uint256 public totalBets;
    address[] public bettors;
    mapping(address => bool) private hasBet;
    
    // Initialization flag
    bool private initialized;

    // ============ Events ============
    
    event BetPlaced(
        address indexed user,
        Outcome outcome,
        uint256 amount,
        uint256 shares,
        uint256 newPrice
    );
    
    event MarketResolved(
        bool outcome,
        uint256 timestamp,
        address resolver
    );
    
    event MarketCancelled(uint256 timestamp);
    
    event Claimed(
        address indexed user,
        uint256 amount
    );
    
    event MarketInitialized(
        string question,
        uint256 endTime,
        address resolver
    );

    // ============ Modifiers ============
    
    modifier onlyResolver() {
        require(msg.sender == resolver, "Only resolver");
        _;
    }
    
    modifier onlyActive() {
        require(state == MarketState.Active, "Market not active");
        require(block.timestamp < endTime, "Market ended");
        _;
    }
    
    modifier onlyEnded() {
        require(block.timestamp >= endTime, "Market not ended");
        _;
    }
    
    modifier onlyResolved() {
        require(state == MarketState.Resolved, "Market not resolved");
        _;
    }
    
    modifier onlyInitialized() {
        require(initialized, "Not initialized");
        _;
    }

    // ============ Initialization ============
    
    /**
     * @notice Initialize the market (called by factory after cloning)
     * @dev Can only be called once
     */
    function initialize(
        string calldata _question,
        string calldata _description,
        uint256 _endTime,
        address _resolver,
        uint256 _minBet,
        uint256 _maxBet,
        bytes calldata /* extraData */
    ) external override {
        require(!initialized, "Already initialized");
        require(_endTime > block.timestamp, "Invalid end time");
        require(_resolver != address(0), "Invalid resolver");
        require(_minBet <= _maxBet, "Invalid bet limits");
        
        question = _question;
        description = _description;
        endTime = _endTime;
        resolver = _resolver;
        minBet = _minBet;
        maxBet = _maxBet;
        factory = msg.sender;
        
        state = MarketState.Active;
        initialized = true;
        
        emit MarketInitialized(_question, _endTime, _resolver);
    }

    // ============ Trading Functions ============
    
    /**
     * @notice Place a bet on an outcome
     * @param outcome True for Yes, False for No
     * @param amount Amount to bet (must equal msg.value)
     */
    function placeBet(bool outcome, uint256 amount)
        external
        payable
        override
        onlyInitialized
        onlyActive
        nonReentrant
    {
        require(msg.value == amount, "Incorrect ETH amount");
        require(amount >= minBet, "Bet too small");
        require(amount <= maxBet, "Bet too large");
        
        // Calculate shares using constant product formula
        uint256 shares = _calculateShares(outcome, amount);
        require(shares > 0, "Invalid shares");
        
        // Update pools
        if (outcome) {
            yesPool += amount;
            yesShares[msg.sender] += shares;
        } else {
            noPool += amount;
            noShares[msg.sender] += shares;
        }
        
        // Track bettor
        if (!hasBet[msg.sender]) {
            bettors.push(msg.sender);
            hasBet[msg.sender] = true;
        }
        
        // Update statistics
        totalVolume += amount;
        totalBets++;
        
        // Notify factory of volume
        if (factory != address(0)) {
            (bool success, ) = factory.call(
                abi.encodeWithSignature("updateMarketVolume(uint256)", amount)
            );
            // Don't revert if factory call fails
        }
        
        emit BetPlaced(
            msg.sender,
            outcome ? Outcome.Yes : Outcome.No,
            amount,
            shares,
            getCurrentPrice()
        );
    }

    // ============ Resolution Functions ============
    
    /**
     * @notice Resolve the market
     * @param outcome The final outcome (true = Yes, false = No)
     */
    function resolve(bool outcome)
        external
        override
        onlyInitialized
        onlyResolver
        onlyEnded
    {
        require(state == MarketState.Active, "Market not active");
        
        state = MarketState.Resolved;
        resolvedOutcome = outcome;
        resolutionTime = block.timestamp;
        
        emit MarketResolved(outcome, block.timestamp, msg.sender);
    }
    
    /**
     * @notice Cancel the market (refunds all bets)
     */
    function cancel()
        external
        override
        onlyInitialized
        onlyResolver
    {
        require(state == MarketState.Active, "Market not active");
        
        state = MarketState.Cancelled;
        
        emit MarketCancelled(block.timestamp);
    }

    // ============ Claim Functions ============
    
    /**
     * @notice Claim winnings or refund
     */
    function claim()
        external
        override
        onlyInitialized
        nonReentrant
    {
        require(
            state == MarketState.Resolved || state == MarketState.Cancelled,
            "Cannot claim yet"
        );
        require(!hasClaimed[msg.sender], "Already claimed");
        
        uint256 payout = 0;
        
        if (state == MarketState.Cancelled) {
            // Refund proportional to shares
            payout = _calculateRefund(msg.sender);
        } else {
            // Pay winners
            payout = _calculatePayout(msg.sender);
        }
        
        require(payout > 0, "Nothing to claim");
        
        hasClaimed[msg.sender] = true;
        
        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "Transfer failed");
        
        emit Claimed(msg.sender, payout);
    }

    // ============ View Functions ============
    
    /**
     * @notice Get the market question
     */
    function getQuestion() external view override returns (string memory) {
        return question;
    }
    
    /**
     * @notice Get the market end time
     */
    function getEndTime() external view override returns (uint256) {
        return endTime;
    }
    
    /**
     * @notice Get total trading volume
     */
    function getTotalVolume() external view override returns (uint256) {
        return totalVolume;
    }
    
    /**
     * @notice Check if market is resolved
     */
    function isResolved() external view override returns (bool) {
        return state == MarketState.Resolved;
    }
    
    /**
     * @notice Get current Yes price (0-100%)
     * @return Price as percentage (0-100)
     */
    function getCurrentPrice() public view onlyInitialized returns (uint256) {
        uint256 totalPool = yesPool + noPool;
        if (totalPool == 0) return 50; // 50% if no bets
        
        return (yesPool * 100) / totalPool;
    }
    
    /**
     * @notice Get user position
     * @param user The user address
     * @return yesShares_ User's Yes shares
     * @return noShares_ User's No shares
     * @return claimable User's claimable amount
     */
    function getUserPosition(address user)
        external
        view
        onlyInitialized
        returns (
            uint256 yesShares_,
            uint256 noShares_,
            uint256 claimable
        )
    {
        yesShares_ = yesShares[user];
        noShares_ = noShares[user];
        
        if (state == MarketState.Resolved && !hasClaimed[user]) {
            claimable = _calculatePayout(user);
        } else if (state == MarketState.Cancelled && !hasClaimed[user]) {
            claimable = _calculateRefund(user);
        }
    }
    
    /**
     * @notice Get market statistics
     */
    function getMarketStats()
        external
        view
        onlyInitialized
        returns (
            uint256 totalVolume_,
            uint256 totalBets_,
            uint256 yesPool_,
            uint256 noPool_,
            uint256 currentPrice,
            uint256 bettorCount
        )
    {
        return (
            totalVolume,
            totalBets,
            yesPool,
            noPool,
            getCurrentPrice(),
            bettors.length
        );
    }
    
    /**
     * @notice Get all bettors
     */
    function getBettors() external view onlyInitialized returns (address[] memory) {
        return bettors;
    }
    
    /**
     * @notice Preview shares for a bet amount
     * @param outcome True for Yes, False for No
     * @param amount Bet amount
     */
    function previewShares(bool outcome, uint256 amount)
        external
        view
        onlyInitialized
        returns (uint256)
    {
        return _calculateShares(outcome, amount);
    }

    // ============ Internal Functions ============
    
    /**
     * @notice Calculate shares using constant product formula
     * @dev Uses k = yesPool * noPool constant
     */
    function _calculateShares(bool outcome, uint256 amount)
        internal
        view
        returns (uint256)
    {
        if (yesPool == 0 && noPool == 0) {
            // First bet gets 1:1 shares
            return amount;
        }
        
        uint256 k = yesPool * noPool;
        
        if (outcome) {
            // Buying Yes shares
            uint256 newYesPool = yesPool + amount;
            uint256 newNoPool = k / newYesPool;
            return noPool - newNoPool;
        } else {
            // Buying No shares
            uint256 newNoPool = noPool + amount;
            uint256 newYesPool = k / newNoPool;
            return yesPool - newYesPool;
        }
    }
    
    /**
     * @notice Calculate payout for a user
     */
    function _calculatePayout(address user) internal view returns (uint256) {
        uint256 totalPool = yesPool + noPool;
        if (totalPool == 0) return 0;
        
        uint256 userShares = resolvedOutcome ? yesShares[user] : noShares[user];
        uint256 totalShares = resolvedOutcome
            ? _getTotalShares(true)
            : _getTotalShares(false);
        
        if (totalShares == 0) return 0;
        
        return (totalPool * userShares) / totalShares;
    }
    
    /**
     * @notice Calculate refund for a user (in case of cancellation)
     */
    function _calculateRefund(address user) internal view returns (uint256) {
        uint256 totalPool = yesPool + noPool;
        if (totalPool == 0) return 0;
        
        uint256 totalUserShares = yesShares[user] + noShares[user];
        uint256 totalShares = _getTotalShares(true) + _getTotalShares(false);
        
        if (totalShares == 0) return 0;
        
        return (totalPool * totalUserShares) / totalShares;
    }
    
    /**
     * @notice Get total shares for an outcome
     */
    function _getTotalShares(bool outcome) internal view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < bettors.length; i++) {
            total += outcome ? yesShares[bettors[i]] : noShares[bettors[i]];
        }
        return total;
    }

    // ============ Receive Function ============
    
    receive() external payable {
        revert("Use placeBet function");
    }
}
