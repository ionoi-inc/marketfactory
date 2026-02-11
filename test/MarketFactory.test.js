const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("MarketFactory", function () {
  let marketFactory;
  let marketImplementation;
  let owner;
  let creator;
  let user1;
  let user2;
  let resolver;

  const CATEGORY_SPORTS = ethers.encodeBytes32String("SPORTS");
  const CATEGORY_POLITICS = ethers.encodeBytes32String("POLITICS");
  const CATEGORY_CRYPTO = ethers.encodeBytes32String("CRYPTO");

  beforeEach(async function () {
    [owner, creator, user1, user2, resolver] = await ethers.getSigners();

    // Deploy a mock Market implementation
    const Market = await ethers.getContractFactory("Market");
    marketImplementation = await Market.deploy();
    await marketImplementation.waitForDeployment();

    // Deploy MarketFactory
    const MarketFactory = await ethers.getContractFactory("MarketFactory");
    marketFactory = await MarketFactory.deploy(
      await marketImplementation.getAddress()
    );
    await marketFactory.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await marketFactory.owner()).to.equal(owner.address);
    });

    it("Should set the correct market implementation", async function () {
      expect(await marketFactory.marketImplementation()).to.equal(
        await marketImplementation.getAddress()
      );
    });

    it("Should initialize with default configuration", async function () {
      expect(await marketFactory.minMarketDuration()).to.equal(3600); // 1 hour
      expect(await marketFactory.maxMarketDuration()).to.equal(31536000); // 365 days
      expect(await marketFactory.creationFee()).to.equal(0);
      expect(await marketFactory.paused()).to.equal(false);
      expect(await marketFactory.requireAuthorization()).to.equal(false);
      expect(await marketFactory.marketCount()).to.equal(0);
    });

    it("Should revert if implementation address is zero", async function () {
      const MarketFactory = await ethers.getContractFactory("MarketFactory");
      await expect(
        MarketFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid implementation");
    });
  });

  describe("Market Creation", function () {
    let marketParams;

    beforeEach(async function () {
      const endTime = (await time.latest()) + 86400; // 1 day from now
      marketParams = {
        question: "Will ETH reach $5000 by end of year?",
        description: "Prediction market for ETH price target",
        endTime: endTime,
        category: CATEGORY_CRYPTO,
        minBet: ethers.parseEther("0.01"),
        maxBet: ethers.parseEther("10"),
        resolver: resolver.address,
        extraData: "0x",
      };
    });

    it("Should create a market successfully", async function () {
      const tx = await marketFactory
        .connect(creator)
        .createMarket(marketParams);
      const receipt = await tx.wait();

      // Check MarketCreated event
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "MarketCreated"
      );
      expect(event).to.not.be.undefined;

      // Verify market count increased
      expect(await marketFactory.marketCount()).to.equal(1);
    });

    it("Should emit MarketCreated event with correct parameters", async function () {
      await expect(marketFactory.connect(creator).createMarket(marketParams))
        .to.emit(marketFactory, "MarketCreated")
        .withArgs(
          (value) => value !== ethers.ZeroAddress, // marketAddress
          creator.address,
          marketParams.question,
          0, // marketId
          marketParams.endTime
        );
    });

    it("Should emit CreatorRegistered event", async function () {
      await expect(marketFactory.connect(creator).createMarket(marketParams))
        .to.emit(marketFactory, "CreatorRegistered")
        .withArgs(creator.address, 1);
    });

    it("Should emit MarketCategorySet event", async function () {
      await expect(marketFactory.connect(creator).createMarket(marketParams))
        .to.emit(marketFactory, "MarketCategorySet")
        .withArgs(0, CATEGORY_CRYPTO);
    });

    it("Should store market information correctly", async function () {
      await marketFactory.connect(creator).createMarket(marketParams);

      const market = await marketFactory.getMarket(0);
      expect(market.creator).to.equal(creator.address);
      expect(market.question).to.equal(marketParams.question);
      expect(market.endTime).to.equal(marketParams.endTime);
      expect(market.status).to.equal(0); // Active
      expect(market.category).to.equal(CATEGORY_CRYPTO);
      expect(market.totalVolume).to.equal(0);
      expect(market.exists).to.equal(true);
    });

    it("Should update creator statistics", async function () {
      await marketFactory.connect(creator).createMarket(marketParams);

      const stats = await marketFactory.getCreatorStats(creator.address);
      expect(stats.marketsCreated).to.equal(1);
      expect(stats.activeMarkets).to.equal(1);
      expect(stats.totalVolume).to.equal(0);
      expect(stats.isVerified).to.equal(false);
    });

    it("Should track creator markets", async function () {
      await marketFactory.connect(creator).createMarket(marketParams);

      const creatorMarkets = await marketFactory.getCreatorMarkets(
        creator.address
      );
      expect(creatorMarkets.length).to.equal(1);
      expect(creatorMarkets[0]).to.equal(0);
    });

    it("Should track markets by category", async function () {
      await marketFactory.connect(creator).createMarket(marketParams);

      const categoryMarkets = await marketFactory.getMarketsByCategory(
        CATEGORY_CRYPTO
      );
      expect(categoryMarkets.length).to.equal(1);
      expect(categoryMarkets[0]).to.equal(0);
    });

    it("Should add category to categories list", async function () {
      await marketFactory.connect(creator).createMarket(marketParams);

      const categories = await marketFactory.getCategories();
      expect(categories.length).to.equal(1);
      expect(categories[0]).to.equal(CATEGORY_CRYPTO);
    });

    it("Should not duplicate categories", async function () {
      await marketFactory.connect(creator).createMarket(marketParams);
      await marketFactory.connect(creator).createMarket(marketParams);

      const categories = await marketFactory.getCategories();
      expect(categories.length).to.equal(1);
    });

    it("Should create multiple markets with different IDs", async function () {
      await marketFactory.connect(creator).createMarket(marketParams);

      const params2 = { ...marketParams, question: "Will BTC reach $100k?" };
      await marketFactory.connect(creator).createMarket(params2);

      expect(await marketFactory.marketCount()).to.equal(2);

      const market0 = await marketFactory.getMarket(0);
      const market1 = await marketFactory.getMarket(1);

      expect(market0.question).to.equal(marketParams.question);
      expect(market1.question).to.equal(params2.question);
    });

    it("Should revert if creation fee is insufficient", async function () {
      await marketFactory.setCreationFee(ethers.parseEther("0.1"));

      await expect(
        marketFactory.connect(creator).createMarket(marketParams, {
          value: ethers.parseEther("0.05"),
        })
      ).to.be.revertedWith("Insufficient creation fee");
    });

    it("Should accept correct creation fee", async function () {
      const fee = ethers.parseEther("0.1");
      await marketFactory.setCreationFee(fee);

      await expect(
        marketFactory.connect(creator).createMarket(marketParams, {
          value: fee,
        })
      ).to.not.be.reverted;
    });

    it("Should revert if factory is paused", async function () {
      await marketFactory.togglePause();

      await expect(
        marketFactory.connect(creator).createMarket(marketParams)
      ).to.be.revertedWith("Factory is paused");
    });

    it("Should revert if question is empty", async function () {
      marketParams.question = "";

      await expect(
        marketFactory.connect(creator).createMarket(marketParams)
      ).to.be.revertedWith("Empty question");
    });

    it("Should revert if end time is in the past", async function () {
      marketParams.endTime = (await time.latest()) - 3600;

      await expect(
        marketFactory.connect(creator).createMarket(marketParams)
      ).to.be.revertedWith("End time in past");
    });

    it("Should revert if duration is too short", async function () {
      marketParams.endTime = (await time.latest()) + 1800; // 30 minutes

      await expect(
        marketFactory.connect(creator).createMarket(marketParams)
      ).to.be.revertedWith("Duration too short");
    });

    it("Should revert if duration is too long", async function () {
      marketParams.endTime = (await time.latest()) + 32000000; // > 1 year

      await expect(
        marketFactory.connect(creator).createMarket(marketParams)
      ).to.be.revertedWith("Duration too long");
    });

    it("Should revert if resolver is zero address", async function () {
      marketParams.resolver = ethers.ZeroAddress;

      await expect(
        marketFactory.connect(creator).createMarket(marketParams)
      ).to.be.revertedWith("Invalid resolver");
    });

    it("Should revert if bet limits are invalid", async function () {
      marketParams.minBet = ethers.parseEther("10");
      marketParams.maxBet = ethers.parseEther("1");

      await expect(
        marketFactory.connect(creator).createMarket(marketParams)
      ).to.be.revertedWith("Invalid bet limits");
    });

    describe("With Authorization Required", function () {
      beforeEach(async function () {
        await marketFactory.toggleRequireAuthorization();
      });

      it("Should allow owner to create markets", async function () {
        await expect(marketFactory.connect(owner).createMarket(marketParams))
          .to.not.be.reverted;
      });

      it("Should allow authorized creators", async function () {
        await marketFactory.setAuthorizedCreator(creator.address, true);

        await expect(marketFactory.connect(creator).createMarket(marketParams))
          .to.not.be.reverted;
      });

      it("Should revert for unauthorized creators", async function () {
        await expect(
          marketFactory.connect(user1).createMarket(marketParams)
        ).to.be.revertedWith("Not authorized creator");
      });
    });
  });

  describe("Market Status Management", function () {
    let marketId;

    beforeEach(async function () {
      const endTime = (await time.latest()) + 86400;
      const marketParams = {
        question: "Test market",
        description: "Test",
        endTime: endTime,
        category: CATEGORY_SPORTS,
        minBet: ethers.parseEther("0.01"),
        maxBet: ethers.parseEther("10"),
        resolver: resolver.address,
        extraData: "0x",
      };

      const tx = await marketFactory.connect(creator).createMarket(marketParams);
      await tx.wait();
      marketId = 0;
    });

    it("Should allow creator to update market status", async function () {
      await expect(
        marketFactory.connect(creator).updateMarketStatus(marketId, 1)
      ) // Paused
        .to.emit(marketFactory, "MarketStatusChanged")
        .withArgs((value) => value !== ethers.ZeroAddress, marketId, 1);

      const market = await marketFactory.getMarket(marketId);
      expect(market.status).to.equal(1);
    });

    it("Should allow owner to update market status", async function () {
      await expect(
        marketFactory.connect(owner).updateMarketStatus(marketId, 2)
      ) // Resolved
        .to.not.be.reverted;

      const market = await marketFactory.getMarket(marketId);
      expect(market.status).to.equal(2);
    });

    it("Should update active market count when pausing", async function () {
      let stats = await marketFactory.getCreatorStats(creator.address);
      expect(stats.activeMarkets).to.equal(1);

      await marketFactory.connect(creator).updateMarketStatus(marketId, 1);

      stats = await marketFactory.getCreatorStats(creator.address);
      expect(stats.activeMarkets).to.equal(0);
    });

    it("Should update active market count when reactivating", async function () {
      await marketFactory.connect(creator).updateMarketStatus(marketId, 1); // Pause

      let stats = await marketFactory.getCreatorStats(creator.address);
      expect(stats.activeMarkets).to.equal(0);

      await marketFactory.connect(creator).updateMarketStatus(marketId, 0); // Active

      stats = await marketFactory.getCreatorStats(creator.address);
      expect(stats.activeMarkets).to.equal(1);
    });

    it("Should revert if market does not exist", async function () {
      await expect(
        marketFactory.connect(creator).updateMarketStatus(999, 1)
      ).to.be.revertedWith("Market does not exist");
    });

    it("Should revert if caller is not authorized", async function () {
      await expect(
        marketFactory.connect(user1).updateMarketStatus(marketId, 1)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Market Volume Updates", function () {
    let marketAddress;
    let marketId;

    beforeEach(async function () {
      const endTime = (await time.latest()) + 86400;
      const marketParams = {
        question: "Test market",
        description: "Test",
        endTime: endTime,
        category: CATEGORY_SPORTS,
        minBet: ethers.parseEther("0.01"),
        maxBet: ethers.parseEther("10"),
        resolver: resolver.address,
        extraData: "0x",
      };

      const tx = await marketFactory.connect(creator).createMarket(marketParams);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(
        (log) => log.fragment && log.fragment.name === "MarketCreated"
      );
      marketAddress = event.args[0];
      marketId = 0;
    });

    it("Should update market volume from market contract", async function () {
      // Impersonate the market contract
      await ethers.provider.send("hardhat_impersonateAccount", [marketAddress]);
      const marketSigner = await ethers.getSigner(marketAddress);

      // Fund the market contract for gas
      await owner.sendTransaction({
        to: marketAddress,
        value: ethers.parseEther("1"),
      });

      const volume = ethers.parseEther("100");
      await marketFactory.connect(marketSigner).updateMarketVolume(volume);

      const market = await marketFactory.getMarket(marketId);
      expect(market.totalVolume).to.equal(volume);

      const stats = await marketFactory.getCreatorStats(creator.address);
      expect(stats.totalVolume).to.equal(volume);

      await ethers.provider.send("hardhat_stopImpersonatingAccount", [
        marketAddress,
      ]);
    });

    it("Should accumulate volume across updates", async function () {
      await ethers.provider.send("hardhat_impersonateAccount", [marketAddress]);
      const marketSigner = await ethers.getSigner(marketAddress);

      await owner.sendTransaction({
        to: marketAddress,
        value: ethers.parseEther("1"),
      });

      await marketFactory
        .connect(marketSigner)
        .updateMarketVolume(ethers.parseEther("50"));
      await marketFactory
        .connect(marketSigner)
        .updateMarketVolume(ethers.parseEther("75"));

      const market = await marketFactory.getMarket(marketId);
      expect(market.totalVolume).to.equal(ethers.parseEther("125"));

      await ethers.provider.send("hardhat_stopImpersonatingAccount", [
        marketAddress,
      ]);
    });

    it("Should revert if caller is not a registered market", async function () {
      await expect(
        marketFactory.connect(user1).updateMarketVolume(ethers.parseEther("100"))
      ).to.be.revertedWith("Market not registered");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Create multiple markets
      const endTime = (await time.latest()) + 86400;

      for (let i = 0; i < 5; i++) {
        const marketParams = {
          question: `Market ${i}`,
          description: `Description ${i}`,
          endTime: endTime,
          category: i % 2 === 0 ? CATEGORY_SPORTS : CATEGORY_CRYPTO,
          minBet: ethers.parseEther("0.01"),
          maxBet: ethers.parseEther("10"),
          resolver: resolver.address,
          extraData: "0x",
        };

        await marketFactory.connect(creator).createMarket(marketParams);
      }
    });

    it("Should get market by ID", async function () {
      const market = await marketFactory.getMarket(2);
      expect(market.question).to.equal("Market 2");
      expect(market.exists).to.equal(true);
    });

    it("Should get market ID by address", async function () {
      const market = await marketFactory.getMarket(1);
      const marketId = await marketFactory.getMarketId(market.marketAddress);
      expect(marketId).to.equal(1);
    });

    it("Should get creator markets", async function () {
      const creatorMarkets = await marketFactory.getCreatorMarkets(
        creator.address
      );
      expect(creatorMarkets.length).to.equal(5);
      expect(creatorMarkets[0]).to.equal(0);
      expect(creatorMarkets[4]).to.equal(4);
    });

    it("Should get markets by category", async function () {
      const sportsMarkets = await marketFactory.getMarketsByCategory(
        CATEGORY_SPORTS
      );
      const cryptoMarkets = await marketFactory.getMarketsByCategory(
        CATEGORY_CRYPTO
      );

      expect(sportsMarkets.length).to.equal(3); // Markets 0, 2, 4
      expect(cryptoMarkets.length).to.equal(2); // Markets 1, 3
    });

    it("Should get markets by status", async function () {
      const activeMarkets = await marketFactory.getMarketsByStatus(0);
      expect(activeMarkets.length).to.equal(5);
    });

    it("Should get paginated markets", async function () {
      const [marketIds, marketInfos, total] = await marketFactory.getMarkets(
        1,
        2
      );

      expect(total).to.equal(5);
      expect(marketIds.length).to.equal(2);
      expect(marketIds[0]).to.equal(1);
      expect(marketIds[1]).to.equal(2);
      expect(marketInfos[0].question).to.equal("Market 1");
      expect(marketInfos[1].question).to.equal("Market 2");
    });

    it("Should handle pagination at boundaries", async function () {
      const [marketIds, , total] = await marketFactory.getMarkets(3, 10);

      expect(total).to.equal(5);
      expect(marketIds.length).to.equal(2); // Only 2 markets left (3, 4)
    });

    it("Should check if address is a market", async function () {
      const market = await marketFactory.getMarket(0);
      expect(await marketFactory.isMarket(market.marketAddress)).to.equal(true);
      expect(await marketFactory.isMarket(user1.address)).to.equal(false);
    });

    it("Should get all categories", async function () {
      const categories = await marketFactory.getCategories();
      expect(categories.length).to.equal(2);
      expect(categories).to.include(CATEGORY_SPORTS);
      expect(categories).to.include(CATEGORY_CRYPTO);
    });

    it("Should get creator stats", async function () {
      const stats = await marketFactory.getCreatorStats(creator.address);
      expect(stats.marketsCreated).to.equal(5);
      expect(stats.activeMarkets).to.equal(5);
      expect(stats.isVerified).to.equal(false);
    });
  });

  describe("Admin Functions", function () {
    it("Should update market implementation", async function () {
      const NewMarket = await ethers.getContractFactory("Market");
      const newImplementation = await NewMarket.deploy();
      await newImplementation.waitForDeployment();

      await expect(
        marketFactory.setMarketImplementation(
          await newImplementation.getAddress()
        )
      )
        .to.emit(marketFactory, "MarketImplementationUpdated")
        .withArgs(
          await marketImplementation.getAddress(),
          await newImplementation.getAddress()
        );

      expect(await marketFactory.marketImplementation()).to.equal(
        await newImplementation.getAddress()
      );
    });

    it("Should revert implementation update with zero address", async function () {
      await expect(
        marketFactory.setMarketImplementation(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid implementation");
    });

    it("Should set market duration limits", async function () {
      await marketFactory.setMarketDurationLimits(7200, 15552000); // 2 hours to 180 days

      expect(await marketFactory.minMarketDuration()).to.equal(7200);
      expect(await marketFactory.maxMarketDuration()).to.equal(15552000);
    });

    it("Should revert invalid duration limits", async function () {
      await expect(
        marketFactory.setMarketDurationLimits(86400, 3600)
      ).to.be.revertedWith("Invalid duration limits");
    });

    it("Should set creation fee", async function () {
      const fee = ethers.parseEther("0.5");
      await marketFactory.setCreationFee(fee);

      expect(await marketFactory.creationFee()).to.equal(fee);
    });

    it("Should toggle pause", async function () {
      expect(await marketFactory.paused()).to.equal(false);

      await marketFactory.togglePause();
      expect(await marketFactory.paused()).to.equal(true);

      await marketFactory.togglePause();
      expect(await marketFactory.paused()).to.equal(false);
    });

    it("Should toggle authorization requirement", async function () {
      expect(await marketFactory.requireAuthorization()).to.equal(false);

      await marketFactory.toggleRequireAuthorization();
      expect(await marketFactory.requireAuthorization()).to.equal(true);

      await marketFactory.toggleRequireAuthorization();
      expect(await marketFactory.requireAuthorization()).to.equal(false);
    });

    it("Should authorize creators", async function () {
      await marketFactory.setAuthorizedCreator(creator.address, true);
      expect(await marketFactory.isAuthorizedCreator(creator.address)).to.equal(
        true
      );

      await marketFactory.setAuthorizedCreator(creator.address, false);
      expect(await marketFactory.isAuthorizedCreator(creator.address)).to.equal(
        false
      );
    });

    it("Should verify creators", async function () {
      await marketFactory.setCreatorVerified(creator.address, true);

      const stats = await marketFactory.getCreatorStats(creator.address);
      expect(stats.isVerified).to.equal(true);
    });

    it("Should withdraw fees", async function () {
      // Create some markets with fees
      await marketFactory.setCreationFee(ethers.parseEther("0.1"));

      const endTime = (await time.latest()) + 86400;
      const marketParams = {
        question: "Test",
        description: "Test",
        endTime: endTime,
        category: CATEGORY_SPORTS,
        minBet: ethers.parseEther("0.01"),
        maxBet: ethers.parseEther("10"),
        resolver: resolver.address,
        extraData: "0x",
      };

      await marketFactory.connect(creator).createMarket(marketParams, {
        value: ethers.parseEther("0.1"),
      });
      await marketFactory.connect(creator).createMarket(marketParams, {
        value: ethers.parseEther("0.1"),
      });

      const initialBalance = await ethers.provider.getBalance(user2.address);
      await marketFactory.withdrawFees(user2.address);
      const finalBalance = await ethers.provider.getBalance(user2.address);

      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("0.2"));
    });

    it("Should revert fee withdrawal to zero address", async function () {
      await expect(
        marketFactory.withdrawFees(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid recipient");
    });

    it("Should revert fee withdrawal when no fees", async function () {
      await expect(marketFactory.withdrawFees(user2.address)).to.be.revertedWith(
        "No fees to withdraw"
      );
    });

    it("Should revert admin functions from non-owner", async function () {
      await expect(
        marketFactory.connect(user1).setCreationFee(ethers.parseEther("1"))
      ).to.be.reverted;

      await expect(marketFactory.connect(user1).togglePause()).to.be.reverted;

      await expect(
        marketFactory.connect(user1).setAuthorizedCreator(creator.address, true)
      ).to.be.reverted;
    });
  });
});
