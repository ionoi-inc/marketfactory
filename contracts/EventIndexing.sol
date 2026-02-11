// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EventIndexing
 * @notice Comprehensive event definitions for off-chain indexing and analytics
 * @dev Inherited by MarketFactory and Market contracts for standardized event emission
 */
interface EventIndexing {
    // ============ Market Lifecycle Events ============
    
    /**
     * @notice Emitted when a new market is created
     * @param marketId Unique identifier for the market
     * @param marketAddress Deployed market contract address
     * @param creator Address that created the market
     * @param question Market question/description
     * @param endTime Timestamp when market closes
     * @param category Market category identifier
     * @param minBet Minimum bet amount
     * @param maxBet Maximum bet amount
     * @param creationFePaid Fee paid for market creation
     */
    event MarketCreated(
        uint256 indexed marketId,
        address indexed marketAddress,
        address indexed creator,
        string question,
        uint256 endTime,
        bytes32 category,
        uint256 minBet,
        uint256 maxBet,
        uint256 creationFeePaid
    );
    
    /**
     * @notice Emitted when a market's status changes
     * @param marketId Market identifier
     * @param previousStatus Previous market status
     * @param newStatus New market status
     * @param timestamp When the status changed
     */
    event MarketStatusChanged(
        uint256 indexed marketId,
        uint8 indexed previousStatus,
        uint8 indexed newStatus,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when a market is resolved
     * @param marketId Market identifier
     * @param resolver Address that resolved the market
     * @param outcome Final outcome (true = Yes, false = No)
     * @param timestamp When resolution occurred
     */
    event MarketResolved(
        uint256 indexed marketId,
        address indexed resolver,
        bool outcome,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when a market is cancelled
     * @param marketId Market identifier
     * @param reason Cancellation reason
     * @param timestamp When cancellation occurred
     */
    event MarketCancelled(
        uint256 indexed marketId,
        string reason,
        uint256 timestamp
    );
    
    // ============ Betting Events ============
    
    /**
     * @notice Emitted when a bet is placed
     * @param marketId Market identifier
     * @param bettor Address placing the bet
     * @param outcome Bet outcome (true = Yes, false = No)
     * @param amount Bet amount in wei
     * @param shares Shares received
     * @param newPrice New share price after bet
     * @param timestamp When bet was placed
     */
    event BetPlaced(
        uint256 indexed marketId,
        address indexed bettor,
        bool indexed outcome,
        uint256 amount,
        uint256 shares,
        uint256 newPrice,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when winnings are claimed
     * @param marketId Market identifier
     * @param winner Address claiming winnings
     * @param amount Payout amount in wei
     * @param shares Shares redeemed
     * @param timestamp When claimed
     */
    event WinningsClaimed(
        uint256 indexed marketId,
        address indexed winner,
        uint256 amount,
        uint256 shares,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when a refund is processed
     * @param marketId Market identifier
     * @param participant Address receiving refund
     * @param amount Refund amount in wei
     * @param timestamp When refunded
     */
    event RefundProcessed(
        uint256 indexed marketId,
        address indexed participant,
        uint256 amount,
        uint256 timestamp
    );
    
    // ============ Volume & Analytics Events ============
    
    /**
     * @notice Emitted when market volume is updated
     * @param marketId Market identifier
     * @param previousVolume Previous total volume
     * @param newVolume New total volume
     * @param volumeAdded Volume added in this transaction
     */
    event VolumeUpdated(
        uint256 indexed marketId,
        uint256 previousVolume,
        uint256 newVolume,
        uint256 volumeAdded
    );
    
    /**
     * @notice Emitted when creator stats are updated
     * @param creator Creator address
     * @param totalMarkets Total markets created
     * @param activeMarkets Currently active markets
     * @param totalVolume Cumulative volume across all markets
     */
    event CreatorStatsUpdated(
        address indexed creator,
        uint256 totalMarkets,
        uint256 activeMarkets,
        uint256 totalVolume
    );
    
    // ============ Administrative Events ============
    
    /**
     * @notice Emitted when a creator is verified
     * @param creator Address that was verified
     * @param verifier Address that performed verification
     * @param timestamp When verification occurred
     */
    event CreatorVerified(
        address indexed creator,
        address indexed verifier,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when a creator's verification is revoked
     * @param creator Address that was unverified
     * @param revoker Address that revoked verification
     * @param timestamp When revocation occurred
     */
    event CreatorUnverified(
        address indexed creator,
        address indexed revoker,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when market creation fee is updated
     * @param previousFee Old fee amount
     * @param newFee New fee amount
     * @param timestamp When update occurred
     */
    event CreationFeeUpdated(
        uint256 previousFee,
        uint256 newFee,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when duration limits are updated
     * @param minDuration New minimum duration
     * @param maxDuration New maximum duration
     * @param timestamp When update occurred
     */
    event DurationLimitsUpdated(
        uint256 minDuration,
        uint256 maxDuration,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when authorization requirement changes
     * @param requiresAuthorization New authorization requirement
     * @param timestamp When update occurred
     */
    event AuthorizationRequirementChanged(
        bool requiresAuthorization,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when platform is paused/unpaused
     * @param isPaused New pause status
     * @param actor Address that changed pause status
     * @param timestamp When change occurred
     */
    event PlatformPauseChanged(
        bool isPaused,
        address indexed actor,
        uint256 timestamp
    );
    
    // ============ Fee Collection Events ============
    
    /**
     * @notice Emitted when fees are withdrawn
     * @param recipient Address receiving fees
     * @param amount Amount withdrawn
     * @param timestamp When withdrawal occurred
     */
    event FeesWithdrawn(
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when platform fee is collected from market
     * @param marketId Market that generated fee
     * @param feeAmount Fee amount collected
     * @param timestamp When fee was collected
     */
    event PlatformFeeCollected(
        uint256 indexed marketId,
        uint256 feeAmount,
        uint256 timestamp
    );
}

/**
 * @title EventEmitter
 * @notice Helper contract for emitting standardized events
 * @dev Can be used by contracts that need to emit events but don't inherit EventIndexing
 */
contract EventEmitter is EventIndexing {
    function emitMarketCreated(
        uint256 marketId,
        address marketAddress,
        address creator,
        string calldata question,
        uint256 endTime,
        bytes32 category,
        uint256 minBet,
        uint256 maxBet,
        uint256 creationFeePaid
    ) external {
        emit MarketCreated(
            marketId,
            marketAddress,
            creator,
            question,
            endTime,
            category,
            minBet,
            maxBet,
            creationFeePaid
        );
    }
    
    function emitBetPlaced(
        uint256 marketId,
        address bettor,
        bool outcome,
        uint256 amount,
        uint256 shares,
        uint256 newPrice
    ) external {
        emit BetPlaced(
            marketId,
            bettor,
            outcome,
            amount,
            shares,
            newPrice,
            block.timestamp
        );
    }
    
    function emitVolumeUpdated(
        uint256 marketId,
        uint256 previousVolume,
        uint256 newVolume,
        uint256 volumeAdded
    ) external {
        emit VolumeUpdated(
            marketId,
            previousVolume,
            newVolume,
            volumeAdded
        );
    }
}
