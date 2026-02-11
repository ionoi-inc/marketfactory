// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MarketFactory.sol";
import "./IMarket.sol";

/**
 * @title MarketBatchOperations
 * @notice Batch operations helper for efficient multi-market queries and operations
 * @dev Gas-optimized batch queries for frontend integration
 */
contract MarketBatchOperations {
    MarketFactory public immutable factory;
    
    // ============ Structs ============
    
    struct MarketInfo {
        uint256 marketId;
        address marketAddress;
        address creator;
        string question;
        uint256 endTime;
        MarketFactory.MarketStatus status;
        bytes32 category;
        uint256 totalVolume;
        bool exists;
    }
    
    struct MarketDetails {
        MarketInfo info;
        uint256 yesPool;
        uint256 noPool;
        uint256 totalBets;
        uint256 participantCount;
        bool isResolved;
        bool outcome;
    }
    
    struct CreatorStats {
        address creator;
        uint256 totalMarkets;
        uint256 activeMarkets;
        uint256 totalVolume;
        bool isVerified;
    }
    
    // ============ Constructor ============
    
    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory address");
        factory = MarketFactory(_factory);
    }
    
    // ============ Batch Query Functions ============
    
    /**
     * @notice Get detailed info for multiple markets
     * @param marketIds Array of market IDs to query
     * @return Array of MarketDetails structs
     */
    function getMarketsDetails(uint256[] calldata marketIds) 
        external 
        view 
        returns (MarketDetails[] memory) 
    {
        MarketDetails[] memory details = new MarketDetails[](marketIds.length);
        
        for (uint256 i = 0; i < marketIds.length; i++) {
            details[i] = getMarketDetails(marketIds[i]);
        }
        
        return details;
    }
    
    /**
     * @notice Get detailed info for a single market
     * @param marketId Market ID to query
     * @return MarketDetails struct with comprehensive market data
     */
    function getMarketDetails(uint256 marketId) 
        public 
        view 
        returns (MarketDetails memory) 
    {
        MarketDetails memory details;
        
        try factory.getMarket(marketId) returns (MarketFactory.MarketInfo memory info) {
            details.info = MarketInfo({
                marketId: marketId,
                marketAddress: info.marketAddress,
                creator: info.creator,
                question: info.question,
                endTime: info.endTime,
                status: info.status,
                category: info.category,
                totalVolume: info.totalVolume,
                exists: true
            });
            
            // Try to get additional details from market contract
            if (info.marketAddress != address(0)) {
                try this.getMarketContractData(info.marketAddress) returns (
                    uint256 yesPool,
                    uint256 noPool,
                    uint256 totalBets,
                    uint256 participantCount,
                    bool isResolved,
                    bool outcome
                ) {
                    details.yesPool = yesPool;
                    details.noPool = noPool;
                    details.totalBets = totalBets;
                    details.participantCount = participantCount;
                    details.isResolved = isResolved;
                    details.outcome = outcome;
                } catch {
                    // Market contract doesn't implement expected interface
                }
            }
        } catch {
            details.info.exists = false;
        }
        
        return details;
    }
    
    /**
     * @notice External function to safely query market contract data
     * @dev Used with try-catch to handle markets that don't implement interface
     */
    function getMarketContractData(address marketAddress) 
        external 
        view 
        returns (
            uint256 yesPool,
            uint256 noPool,
            uint256 totalBets,
            uint256 participantCount,
            bool isResolved,
            bool outcome
        ) 
    {
        IMarket market = IMarket(marketAddress);
        
        // This will revert if market doesn't implement these methods
        yesPool = market.yesPool();
        noPool = market.noPool();
        totalBets = market.totalBets();
        participantCount = market.participantCount();
        isResolved = market.isResolved();
        outcome = market.outcome();
    }
    
    /**
     * @notice Get all markets for multiple creators
     * @param creators Array of creator addresses
     * @return Array of arrays containing market IDs for each creator
     */
    function getCreatorsMarkets(address[] calldata creators) 
        external 
        view 
        returns (uint256[][] memory) 
    {
        uint256[][] memory allMarkets = new uint256[][](creators.length);
        
        for (uint256 i = 0; i < creators.length; i++) {
            allMarkets[i] = factory.getMarketsByCreator(creators[i]);
        }
        
        return allMarkets;
    }
    
    /**
     * @notice Get stats for multiple creators
     * @param creators Array of creator addresses
     * @return Array of CreatorStats structs
     */
    function getCreatorsStats(address[] calldata creators) 
        external 
        view 
        returns (CreatorStats[] memory) 
    {
        CreatorStats[] memory stats = new CreatorStats[](creators.length);
        
        for (uint256 i = 0; i < creators.length; i++) {
            MarketFactory.CreatorInfo memory info = factory.getCreatorInfo(creators[i]);
            stats[i] = CreatorStats({
                creator: creators[i],
                totalMarkets: info.totalMarkets,
                activeMarkets: info.activeMarkets,
                totalVolume: info.totalVolume,
                isVerified: info.isVerified
            });
        }
        
        return stats;
    }
    
    /**
     * @notice Get markets by category with pagination
     * @param category Category to filter by
     * @param offset Starting index
     * @param limit Maximum results to return
     * @return markets Array of market IDs
     * @return hasMore Whether more results exist
     */
    function getMarketsByCategoryPaginated(
        bytes32 category,
        uint256 offset,
        uint256 limit
    ) 
        external 
        view 
        returns (uint256[] memory markets, bool hasMore) 
    {
        uint256[] memory allMarkets = factory.getMarketsByCategory(category);
        
        if (offset >= allMarkets.length) {
            return (new uint256[](0), false);
        }
        
        uint256 end = offset + limit;
        if (end > allMarkets.length) {
            end = allMarkets.length;
        }
        
        uint256 resultLength = end - offset;
        markets = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            markets[i] = allMarkets[offset + i];
        }
        
        hasMore = end < allMarkets.length;
    }
    
    /**
     * @notice Get markets by status with pagination
     * @param status Status to filter by
     * @param offset Starting index
     * @param limit Maximum results to return
     * @return markets Array of market IDs
     * @return hasMore Whether more results exist
     */
    function getMarketsByStatusPaginated(
        MarketFactory.MarketStatus status,
        uint256 offset,
        uint256 limit
    ) 
        external 
        view 
        returns (uint256[] memory markets, bool hasMore) 
    {
        uint256[] memory allMarkets = factory.getMarketsByStatus(status);
        
        if (offset >= allMarkets.length) {
            return (new uint256[](0), false);
        }
        
        uint256 end = offset + limit;
        if (end > allMarkets.length) {
            end = allMarkets.length;
        }
        
        uint256 resultLength = end - offset;
        markets = new uint256[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            markets[i] = allMarkets[offset + i];
        }
        
        hasMore = end < allMarkets.length;
    }
    
    /**
     * @notice Get the most active markets by volume
     * @param limit Maximum results to return
     * @return marketIds Array of market IDs sorted by volume
     * @return volumes Array of corresponding volumes
     */
    function getTopMarketsByVolume(uint256 limit) 
        external 
        view 
        returns (uint256[] memory marketIds, uint256[] memory volumes) 
    {
        uint256 totalMarkets = factory.marketCount();
        if (totalMarkets == 0) {
            return (new uint256[](0), new uint256[](0));
        }
        
        // Limit results to available markets
        if (limit > totalMarkets) {
            limit = totalMarkets;
        }
        
        marketIds = new uint256[](limit);
        volumes = new uint256[](limit);
        
        // Simple selection of top markets by iterating through all
        // In production, consider maintaining a sorted list on-chain or off-chain indexing
        for (uint256 i = 0; i < limit && i < totalMarkets; i++) {
            uint256 maxVolume = 0;
            uint256 maxId = 0;
            
            for (uint256 j = 0; j < totalMarkets; j++) {
                try factory.getMarket(j) returns (MarketFactory.MarketInfo memory info) {
                    if (info.totalVolume > maxVolume) {
                        // Check if not already selected
                        bool alreadySelected = false;
                        for (uint256 k = 0; k < i; k++) {
                            if (marketIds[k] == j) {
                                alreadySelected = true;
                                break;
                            }
                        }
                        
                        if (!alreadySelected) {
                            maxVolume = info.totalVolume;
                            maxId = j;
                        }
                    }
                } catch {
                    continue;
                }
            }
            
            marketIds[i] = maxId;
            volumes[i] = maxVolume;
        }
        
        return (marketIds, volumes);
    }
    
    /**
     * @notice Check if multiple markets are active
     * @param marketIds Array of market IDs to check
     * @return Array of booleans indicating if each market is active
     */
    function areMarketsActive(uint256[] calldata marketIds) 
        external 
        view 
        returns (bool[] memory) 
    {
        bool[] memory isActive = new bool[](marketIds.length);
        
        for (uint256 i = 0; i < marketIds.length; i++) {
            try factory.getMarket(marketIds[i]) returns (MarketFactory.MarketInfo memory info) {
                isActive[i] = (info.status == MarketFactory.MarketStatus.Active);
            } catch {
                isActive[i] = false;
            }
        }
        
        return isActive;
    }
    
    /**
     * @notice Get comprehensive platform statistics
     * @return totalMarkets Total number of markets created
     * @return activeMarkets Number of currently active markets
     * @return totalVolume Cumulative volume across all markets
     * @return uniqueCreators Number of unique market creators
     */
    function getPlatformStats() 
        external 
        view 
        returns (
            uint256 totalMarkets,
            uint256 activeMarkets,
            uint256 totalVolume,
            uint256 uniqueCreators
        ) 
    {
        totalMarkets = factory.marketCount();
        totalVolume = factory.totalVolume();
        
        // Count active markets
        for (uint256 i = 0; i < totalMarkets; i++) {
            try factory.getMarket(i) returns (MarketFactory.MarketInfo memory info) {
                if (info.status == MarketFactory.MarketStatus.Active) {
                    activeMarkets++;
                }
            } catch {
                continue;
            }
        }
        
        // Note: uniqueCreators would require maintaining a separate set on-chain
        // For efficiency, this should be tracked off-chain via event indexing
        uniqueCreators = 0; // Placeholder
    }
}
