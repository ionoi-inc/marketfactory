# MarketFactory - Prediction Market Deployment & Registry

A gas-efficient factory contract for deploying and managing prediction markets using the minimal proxy pattern (EIP-1167).

## Overview

MarketFactory provides a complete solution for:
- **Market Deployment**: Clone-based deployment for gas efficiency
- **Registry Management**: Centralized tracking of all markets
- **Creator Analytics**: Statistics and verification for market creators
- **Category Organization**: Group markets by topic/category
- **Access Control**: Optional authorization and verification system
- **Volume Tracking**: Aggregate volume metrics across markets

## Architecture

```
MarketFactory (Registry & Deployment)
    │
    ├── Market Implementation (Template)
    │
    └── Market Clones (Minimal Proxies)
         ├── Market #1
         ├── Market #2
         └── Market #n
```

### Key Components

1. **MarketFactory.sol** - Main factory and registry contract
2. **IMarket.sol** - Interface for market contracts
3. **Market.sol** - Implementation contract (to be cloned)

## Features

### 1. Market Creation

Create prediction markets with comprehensive parameters:

```solidity
struct MarketParams {
    string question;        // Market question
    string description;     // Detailed description
    uint256 endTime;       // Market end timestamp
    bytes32 category;      // Category identifier
    uint256 minBet;        // Minimum bet amount
    uint256 maxBet;        // Maximum bet amount
    address resolver;      // Resolver address
    bytes extraData;       // Additional configuration
}
```

**Gas Efficiency**: Uses minimal proxy pattern (EIP-1167) - deploys markets for ~45k gas vs ~2M for full deployment.

### 2. Market Registry

Every market is tracked with:
- Unique market ID
- Creator information
- Creation and end timestamps
- Current status (Active, Paused, Resolved, Cancelled, Invalid)
- Category classification
- Total volume metrics

### 3. Creator Management

Track creator performance and reputation:
- Markets created count
- Total volume across all markets
- Active markets count
- Verification status
- Per-creator market listings

### 4. Category System

Organize markets by topic:
- Sports: `ethers.encodeBytes32String("SPORTS")`
- Politics: `ethers.encodeBytes32String("POLITICS")`
- Crypto: `ethers.encodeBytes32String("CRYPTO")`
- Custom categories as needed

### 5. Access Control

Optional authorization system:
- Require creator authorization
- Creator verification badges
- Owner controls for sensitive operations
- Emergency pause functionality

## Usage

### Deployment

```javascript
// Deploy Market implementation
const Market = await ethers.getContractFactory("Market");
const marketImplementation = await Market.deploy();

// Deploy MarketFactory
const MarketFactory = await ethers.getContractFactory("MarketFactory");
const factory = await MarketFactory.deploy(
    await marketImplementation.getAddress()
);
```

### Creating a Market

```javascript
const marketParams = {
    question: "Will ETH reach $5000 by end of 2024?",
    description: "Prediction market for ETH price target",
    endTime: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
    category: ethers.encodeBytes32String("CRYPTO"),
    minBet: ethers.parseEther("0.01"),
    maxBet: ethers.parseEther("10"),
    resolver: resolverAddress,
    extraData: "0x"
};

const tx = await factory.createMarket(marketParams, {
    value: await factory.creationFee() // Pay creation fee if required
});
const receipt = await tx.wait();

// Get market ID and address from event
const event = receipt.logs.find(log => log.fragment?.name === "MarketCreated");
const [marketAddress, creator, question, marketId, endTime] = event.args;
```

### Querying Markets

```javascript
// Get market by ID
const market = await factory.getMarket(marketId);

// Get creator's markets
const creatorMarkets = await factory.getCreatorMarkets(creatorAddress);

// Get markets by category
const cryptoMarkets = await factory.getMarketsByCategory(
    ethers.encodeBytes32String("CRYPTO")
);

// Get markets by status (Active = 0)
const activeMarkets = await factory.getMarketsByStatus(0);

// Paginated list
const [marketIds, marketInfos, total] = await factory.getMarkets(0, 10);

// Creator statistics
const stats = await factory.getCreatorStats(creatorAddress);
// Returns: { marketsCreated, totalVolume, activeMarkets, isVerified }
```

### Managing Markets

```javascript
// Update market status (creator or owner only)
await factory.updateMarketStatus(marketId, 1); // 1 = Paused

// Update volume (called by market contracts)
await factory.updateMarketVolume(volumeAmount);
```

### Admin Configuration

```javascript
// Set creation fee
await factory.setCreationFee(ethers.parseEther("0.01"));

// Set duration limits
await factory.setMarketDurationLimits(
    3600,      // Min: 1 hour
    7776000    // Max: 90 days
);

// Enable authorization requirement
await factory.toggleRequireAuthorization();

// Authorize creators
await factory.setAuthorizedCreator(creatorAddress, true);

// Verify creators
await factory.setCreatorVerified(creatorAddress, true);

// Update implementation (for future markets)
await factory.setMarketImplementation(newImplementationAddress);

// Pause/unpause factory
await factory.togglePause();

// Withdraw collected fees
await factory.withdrawFees(recipientAddress);
```

## Market Status Flow

```
Active (0)
  ├─> Paused (1) ──> Active (0)
  ├─> Resolved (2)
  ├─> Cancelled (3)
  └─> Invalid (4)
```

## Events

```solidity
event MarketCreated(
    address indexed marketAddress,
    address indexed creator,
    string question,
    uint256 indexed marketId,
    uint256 endTime
);

event MarketStatusChanged(
    address indexed marketAddress,
    uint256 indexed marketId,
    MarketStatus status
);

event CreatorRegistered(
    address indexed creator,
    uint256 marketCount
);

event MarketCategorySet(
    uint256 indexed marketId,
    bytes32 indexed category
);

event MarketImplementationUpdated(
    address indexed oldImplementation,
    address indexed newImplementation
);
```

## Security Features

1. **ReentrancyGuard**: Protects against reentrancy attacks
2. **Access Control**: Owner-only admin functions
3. **Validation**: Comprehensive parameter validation
4. **Pause Mechanism**: Emergency stop functionality
5. **Authorization System**: Optional creator whitelist

## Gas Optimization

- Minimal proxy pattern reduces deployment cost by ~95%
- Efficient storage layout
- Batch operations where possible
- View functions for off-chain queries

## Testing

Comprehensive test suite covering:
- Market creation and validation
- Status management
- Volume tracking
- Creator statistics
- Pagination
- Access control
- Admin functions
- Edge cases and security

Run tests:
```bash
npx hardhat test test/MarketFactory.test.js
```

## Integration Guide

### Frontend Integration

```javascript
// Connect to factory
const factory = new ethers.Contract(
    FACTORY_ADDRESS,
    FACTORY_ABI,
    signer
);

// Create market
const tx = await factory.createMarket(params, { value: fee });
await tx.wait();

// Listen for new markets
factory.on("MarketCreated", (address, creator, question, id, endTime) => {
    console.log(`New market created: ${question} at ${address}`);
});

// Get market details
const market = await factory.getMarket(marketId);
const marketContract = new ethers.Contract(
    market.marketAddress,
    MARKET_ABI,
    signer
);
```

### Subgraph Integration

Index these events for efficient queries:
- `MarketCreated` - New market tracking
- `MarketStatusChanged` - Status updates
- `MarketCategorySet` - Category filtering
- `CreatorRegistered` - Creator analytics

## Configuration Examples

### Public Market Creation
```javascript
// No fees, no authorization
await factory.setCreationFee(0);
await factory.toggleRequireAuthorization(); // Set to false
```

### Curated Platform
```javascript
// With fees and authorization
await factory.setCreationFee(ethers.parseEther("0.05"));
await factory.toggleRequireAuthorization(); // Set to true
await factory.setAuthorizedCreator(trustedCreator, true);
```

### Time-Limited Markets
```javascript
// Short-term events only (1 hour to 7 days)
await factory.setMarketDurationLimits(3600, 604800);
```

## Best Practices

1. **Market Creation**:
   - Clear, specific questions
   - Reasonable time frames
   - Appropriate resolver selection
   - Relevant category classification

2. **Status Management**:
   - Only pause when necessary
   - Resolve promptly after end time
   - Cancel only for critical issues

3. **Volume Tracking**:
   - Markets should call `updateMarketVolume()` on trades
   - Ensures accurate creator statistics

4. **Authorization**:
   - Enable for curated platforms
   - Verify high-quality creators
   - Monitor creator performance

## Upgradeability

The factory supports upgrading the market implementation:
- New markets use the updated implementation
- Existing markets continue with their original implementation
- No disruption to deployed markets

```javascript
await factory.setMarketImplementation(newImplementationAddress);
```

## Network Deployment

### Testnet
- Lower creation fees for testing
- Open authorization for experimentation
- Extended duration limits

### Mainnet
- Production-ready configuration
- Appropriate fees and limits
- Consider authorization for quality control
- Implement monitoring and alerts

## Troubleshooting

### "Insufficient creation fee"
- Check current fee: `await factory.creationFee()`
- Send correct amount with transaction

### "Duration too short/long"
- Check limits: `await factory.minMarketDuration()` / `maxMarketDuration()`
- Adjust endTime parameter

### "Not authorized creator"
- Authorization is enabled
- Request authorization or disable requirement

### "Market does not exist"
- Verify market ID is valid
- Check if market was created successfully

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions:
- GitHub Issues: [Your Repo]
- Documentation: [Your Docs]
- Discord: [Your Server]
