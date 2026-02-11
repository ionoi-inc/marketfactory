/**
 * Frontend Integration Helpers for MarketFactory
 * 
 * This module provides utilities for integrating the MarketFactory
 * smart contracts with web3 frontend applications.
 */

import { ethers } from 'ethers';

// Contract ABIs (import these from your compiled artifacts)
import MarketFactoryABI from './abis/MarketFactory.json';
import MarketABI from './abis/Market.json';
import MarketBatchOperationsABI from './abis/MarketBatchOperations.json';
import MarketTemplatesABI from './abis/MarketTemplates.json';

/**
 * MarketFactorySDK - Main SDK class for interacting with the platform
 */
export class MarketFactorySDK {
  constructor(provider, contractAddresses) {
    this.provider = provider;
    this.addresses = contractAddresses;
    
    // Initialize contract instances
    this.factory = new ethers.Contract(
      contractAddresses.factory,
      MarketFactoryABI,
      provider
    );
    
    this.batchOps = new ethers.Contract(
      contractAddresses.batchOperations,
      MarketBatchOperationsABI,
      provider
    );
    
    if (contractAddresses.templates) {
      this.templates = new ethers.Contract(
        contractAddresses.templates,
        MarketTemplatesABI,
        provider
      );
    }
  }
  
  /**
   * Connect with signer for write operations
   */
  connect(signer) {
    return new MarketFactorySDK(signer, this.addresses);
  }
  
  // ============ Market Creation ============
  
  /**
   * Create a new market
   * @param {Object} params - Market parameters
   * @param {string} params.question - Market question
   * @param {string} params.description - Market description
   * @param {number} params.endTime - Unix timestamp for market end
   * @param {string} params.resolver - Resolver address
   * @param {string} params.category - Category name (will be hashed)
   * @param {BigNumber} params.minBet - Minimum bet amount in wei
   * @param {BigNumber} params.maxBet - Maximum bet amount in wei
   * @param {BigNumber} params.creationFee - Fee to send (optional, will fetch if not provided)
   */
  async createMarket(params) {
    const factory = this.factory.connect(this.provider.getSigner());
    
    // Fetch creation fee if not provided
    const creationFee = params.creationFee || await factory.creationFee();
    
    // Hash category
    const categoryHash = ethers.id(params.category);
    
    const tx = await factory.createMarket(
      params.question,
      params.description,
      params.endTime,
      params.resolver,
      categoryHash,
      params.minBet || ethers.parseEther("0.01"),
      params.maxBet || ethers.parseEther("10"),
      "0x", // extraData
      { value: creationFee }
    );
    
    const receipt = await tx.wait();
    
    // Extract market ID from event
    const event = receipt.logs.find(
      log => log.topics[0] === ethers.id("MarketCreated(uint256,address,address,string,uint256,bytes32,uint256,uint256,uint256)")
    );
    
    if (event) {
      const decoded = factory.interface.parseLog(event);
      return {
        marketId: decoded.args.marketId,
        marketAddress: decoded.args.marketAddress,
        transactionHash: receipt.hash
      };
    }
    
    throw new Error("MarketCreated event not found");
  }
  
  /**
   * Create market from template
   */
  async createMarketFromTemplate(templateId, question, description, endTime) {
    if (!this.templates) {
      throw new Error("Templates contract not initialized");
    }
    
    const template = await this.templates.getTemplate(templateId);
    
    return this.createMarket({
      question,
      description,
      endTime: endTime || Math.floor(Date.now() / 1000) + template.defaultDuration,
      resolver: ethers.ZeroAddress, // Will be set by factory
      category: template.category,
      minBet: template.minBet,
      maxBet: template.maxBet
    });
  }
  
  // ============ Market Queries ============
  
  /**
   * Get market details by ID
   */
  async getMarket(marketId) {
    const info = await this.factory.getMarket(marketId);
    return this._formatMarketInfo(info);
  }
  
  /**
   * Get detailed market info including contract state
   */
  async getMarketDetails(marketId) {
    const details = await this.batchOps.getMarketDetails(marketId);
    return this._formatMarketDetails(details);
  }
  
  /**
   * Get multiple markets efficiently
   */
  async getMarketsDetails(marketIds) {
    const details = await this.batchOps.getMarketsDetails(marketIds);
    return details.map(d => this._formatMarketDetails(d));
  }
  
  /**
   * Get all active markets with pagination
   */
  async getActiveMarkets(offset = 0, limit = 20) {
    const result = await this.batchOps.getMarketsByStatusPaginated(
      0, // Active status
      offset,
      limit
    );
    
    return {
      markets: result.markets.map(id => id.toString()),
      hasMore: result.hasMore
    };
  }
  
  /**
   * Get markets by category
   */
  async getMarketsByCategory(category, offset = 0, limit = 20) {
    const categoryHash = ethers.id(category);
    const result = await this.batchOps.getMarketsByCategoryPaginated(
      categoryHash,
      offset,
      limit
    );
    
    return {
      markets: result.markets.map(id => id.toString()),
      hasMore: result.hasMore
    };
  }
  
  /**
   * Get markets created by address
   */
  async getMarketsByCreator(creator) {
    const marketIds = await this.factory.getMarketsByCreator(creator);
    return marketIds.map(id => id.toString());
  }
  
  /**
   * Get top markets by volume
   */
  async getTopMarketsByVolume(limit = 10) {
    const result = await this.batchOps.getTopMarketsByVolume(limit);
    
    return result.marketIds.map((id, index) => ({
      marketId: id.toString(),
      volume: ethers.formatEther(result.volumes[index])
    }));
  }
  
  /**
   * Search markets by text (requires event indexing backend)
   */
  async searchMarkets(query) {
    // This would typically query an indexer/subgraph
    // Placeholder for demonstration
    throw new Error("Search requires backend indexer - see integration guide");
  }
  
  // ============ Market Interactions ============
  
  /**
   * Place a bet on a market
   */
  async placeBet(marketId, outcome, amount) {
    const marketInfo = await this.factory.getMarket(marketId);
    const market = new ethers.Contract(
      marketInfo.marketAddress,
      MarketABI,
      this.provider.getSigner()
    );
    
    const tx = await market.placeBet(outcome, amount, { value: amount });
    const receipt = await tx.wait();
    
    return {
      transactionHash: receipt.hash,
      status: receipt.status
    };
  }
  
  /**
   * Claim winnings from a resolved market
   */
  async claimWinnings(marketId) {
    const marketInfo = await this.factory.getMarket(marketId);
    const market = new ethers.Contract(
      marketInfo.marketAddress,
      MarketABI,
      this.provider.getSigner()
    );
    
    const tx = await market.claimWinnings();
    const receipt = await tx.wait();
    
    return {
      transactionHash: receipt.hash,
      status: receipt.status
    };
  }
  
  /**
   * Get user's position in a market
   */
  async getUserPosition(marketId, userAddress) {
    const marketInfo = await this.factory.getMarket(marketId);
    const market = new ethers.Contract(
      marketInfo.marketAddress,
      MarketABI,
      this.provider
    );
    
    const yesShares = await market.userYesShares(userAddress);
    const noShares = await market.userNoShares(userAddress);
    const totalBet = await market.userTotalBet(userAddress);
    
    return {
      yesShares: ethers.formatEther(yesShares),
      noShares: ethers.formatEther(noShares),
      totalBet: ethers.formatEther(totalBet)
    };
  }
  
  // ============ Creator Functions ============
  
  /**
   * Get creator statistics
   */
  async getCreatorStats(address) {
    const info = await this.factory.getCreatorInfo(address);
    
    return {
      totalMarkets: info.totalMarkets.toString(),
      activeMarkets: info.activeMarkets.toString(),
      totalVolume: ethers.formatEther(info.totalVolume),
      isVerified: info.isVerified
    };
  }
  
  /**
   * Resolve a market (creator/resolver only)
   */
  async resolveMarket(marketId, outcome) {
    const factory = this.factory.connect(this.provider.getSigner());
    const tx = await factory.resolveMarket(marketId, outcome);
    await tx.wait();
    
    return { success: true };
  }
  
  /**
   * Cancel a market (creator/admin only)
   */
  async cancelMarket(marketId, reason = "") {
    const factory = this.factory.connect(this.provider.getSigner());
    const tx = await factory.cancelMarket(marketId, reason);
    await tx.wait();
    
    return { success: true };
  }
  
  // ============ Platform Statistics ============
  
  /**
   * Get overall platform statistics
   */
  async getPlatformStats() {
    const stats = await this.batchOps.getPlatformStats();
    
    return {
      totalMarkets: stats.totalMarkets.toString(),
      activeMarkets: stats.activeMarkets.toString(),
      totalVolume: ethers.formatEther(stats.totalVolume),
      uniqueCreators: stats.uniqueCreators.toString()
    };
  }
  
  // ============ Template Functions ============
  
  /**
   * Get all available templates
   */
  async getTemplates() {
    if (!this.templates) return [];
    
    const templateIds = await this.templates.getActiveTemplates();
    
    const templates = await Promise.all(
      templateIds.map(id => this.templates.getTemplate(id))
    );
    
    return templates.map((t, i) => ({
      id: templateIds[i],
      name: t.name,
      description: t.description,
      defaultDuration: t.defaultDuration.toString(),
      minBet: ethers.formatEther(t.minBet),
      maxBet: ethers.formatEther(t.maxBet),
      category: t.category
    }));
  }
  
  // ============ Event Listening ============
  
  /**
   * Listen for market creation events
   */
  onMarketCreated(callback) {
    this.factory.on("MarketCreated", (marketId, marketAddress, creator, question, ...args) => {
      callback({
        marketId: marketId.toString(),
        marketAddress,
        creator,
        question
      });
    });
  }
  
  /**
   * Listen for bet events on a specific market
   */
  onBetPlaced(marketAddress, callback) {
    const market = new ethers.Contract(marketAddress, MarketABI, this.provider);
    
    market.on("BetPlaced", (bettor, outcome, amount, shares, ...args) => {
      callback({
        bettor,
        outcome,
        amount: ethers.formatEther(amount),
        shares: ethers.formatEther(shares)
      });
    });
  }
  
  /**
   * Stop listening to all events
   */
  removeAllListeners() {
    this.factory.removeAllListeners();
  }
  
  // ============ Helper Functions ============
  
  _formatMarketInfo(info) {
    return {
      marketId: info.marketId?.toString(),
      marketAddress: info.marketAddress,
      creator: info.creator,
      question: info.question,
      endTime: info.endTime?.toString(),
      status: this._getStatusName(info.status),
      category: info.category,
      totalVolume: ethers.formatEther(info.totalVolume || 0)
    };
  }
  
  _formatMarketDetails(details) {
    return {
      ...this._formatMarketInfo(details.info),
      yesPool: ethers.formatEther(details.yesPool || 0),
      noPool: ethers.formatEther(details.noPool || 0),
      totalBets: details.totalBets?.toString(),
      participantCount: details.participantCount?.toString(),
      isResolved: details.isResolved,
      outcome: details.outcome
    };
  }
  
  _getStatusName(status) {
    const statuses = ['Active', 'Paused', 'Resolved', 'Cancelled', 'Invalid'];
    return statuses[status] || 'Unknown';
  }
}

/**
 * React Hooks for MarketFactory
 */
export const useMarketFactory = (provider, addresses) => {
  const [sdk, setSdk] = React.useState(null);
  
  React.useEffect(() => {
    if (provider && addresses) {
      setSdk(new MarketFactorySDK(provider, addresses));
    }
  }, [provider, addresses]);
  
  return sdk;
};

/**
 * Hook for fetching market data
 */
export const useMarket = (sdk, marketId) => {
  const [market, setMarket] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  
  React.useEffect(() => {
    if (!sdk || !marketId) return;
    
    const fetchMarket = async () => {
      try {
        setLoading(true);
        const data = await sdk.getMarketDetails(marketId);
        setMarket(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMarket();
  }, [sdk, marketId]);
  
  return { market, loading, error };
};

/**
 * Hook for user's positions across all markets
 */
export const useUserPositions = (sdk, userAddress) => {
  const [positions, setPositions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  
  React.useEffect(() => {
    if (!sdk || !userAddress) return;
    
    const fetchPositions = async () => {
      try {
        setLoading(true);
        const marketIds = await sdk.getMarketsByCreator(userAddress);
        
        const positionsData = await Promise.all(
          marketIds.map(async (id) => {
            const position = await sdk.getUserPosition(id, userAddress);
            const market = await sdk.getMarket(id);
            return { marketId: id, market, position };
          })
        );
        
        setPositions(positionsData.filter(p => 
          parseFloat(p.position.totalBet) > 0
        ));
      } catch (err) {
        console.error('Error fetching positions:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPositions();
  }, [sdk, userAddress]);
  
  return { positions, loading };
};

/**
 * Utility functions
 */
export const utils = {
  /**
   * Calculate share price for a bet
   */
  calculateSharePrice: (yesPool, noPool, amount, isYes) => {
    const k = yesPool * noPool;
    const newPool = isYes ? yesPool + amount : noPool + amount;
    const otherNewPool = k / newPool;
    const shares = (isYes ? noPool : yesPool) - otherNewPool;
    return shares / amount;
  },
  
  /**
   * Calculate potential payout
   */
  calculatePayout: (shares, totalWinningPool, totalLosingPool) => {
    const totalPool = totalWinningPool + totalLosingPool;
    return (shares / totalWinningPool) * totalPool;
  },
  
  /**
   * Format time remaining
   */
  formatTimeRemaining: (endTime) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = endTime - now;
    
    if (remaining < 0) return 'Ended';
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  },
  
  /**
   * Validate market parameters
   */
  validateMarketParams: (params) => {
    const errors = [];
    
    if (!params.question || params.question.length < 10) {
      errors.push('Question must be at least 10 characters');
    }
    
    if (!params.endTime || params.endTime <= Date.now() / 1000) {
      errors.push('End time must be in the future');
    }
    
    if (params.minBet && params.maxBet && params.minBet >= params.maxBet) {
      errors.push('Min bet must be less than max bet');
    }
    
    return errors;
  }
};

export default MarketFactorySDK;
