// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MarketTemplates
 * @notice Reusable templates for common market configurations
 * @dev Companion contract to MarketFactory for standardized market types
 */
contract MarketTemplates is Ownable {
    // ============ Structs ============
    
    struct Template {
        string name;
        string description;
        uint256 defaultDuration;
        uint256 minBet;
        uint256 maxBet;
        bytes32 category;
        bool requiresVerifiedCreator;
        bool isActive;
        uint256 createdAt;
    }
    
    // ============ State Variables ============
    
    mapping(bytes32 => Template) public templates;
    bytes32[] public templateIds;
    
    // ============ Events ============
    
    event TemplateCreated(bytes32 indexed templateId, string name, bytes32 category);
    event TemplateUpdated(bytes32 indexed templateId, string name);
    event TemplateToggled(bytes32 indexed templateId, bool isActive);
    
    // ============ Constructor ============
    
    constructor(address initialOwner) Ownable(initialOwner) {
        _createDefaultTemplates();
    }
    
    // ============ Template Management ============
    
    function createTemplate(
        string calldata name,
        string calldata description,
        uint256 defaultDuration,
        uint256 minBet,
        uint256 maxBet,
        bytes32 category,
        bool requiresVerifiedCreator
    ) external onlyOwner returns (bytes32) {
        bytes32 templateId = keccak256(abi.encodePacked(name, block.timestamp));
        
        require(templates[templateId].createdAt == 0, "Template ID collision");
        
        templates[templateId] = Template({
            name: name,
            description: description,
            defaultDuration: defaultDuration,
            minBet: minBet,
            maxBet: maxBet,
            category: category,
            requiresVerifiedCreator: requiresVerifiedCreator,
            isActive: true,
            createdAt: block.timestamp
        });
        
        templateIds.push(templateId);
        
        emit TemplateCreated(templateId, name, category);
        return templateId;
    }
    
    function updateTemplate(
        bytes32 templateId,
        string calldata description,
        uint256 defaultDuration,
        uint256 minBet,
        uint256 maxBet
    ) external onlyOwner {
        Template storage template = templates[templateId];
        require(template.createdAt != 0, "Template does not exist");
        
        template.description = description;
        template.defaultDuration = defaultDuration;
        template.minBet = minBet;
        template.maxBet = maxBet;
        
        emit TemplateUpdated(templateId, template.name);
    }
    
    function toggleTemplate(bytes32 templateId) external onlyOwner {
        Template storage template = templates[templateId];
        require(template.createdAt != 0, "Template does not exist");
        
        template.isActive = !template.isActive;
        emit TemplateToggled(templateId, template.isActive);
    }
    
    // ============ View Functions ============
    
    function getTemplate(bytes32 templateId) external view returns (Template memory) {
        return templates[templateId];
    }
    
    function getActiveTemplates() external view returns (bytes32[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < templateIds.length; i++) {
            if (templates[templateIds[i]].isActive) {
                activeCount++;
            }
        }
        
        bytes32[] memory active = new bytes32[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < templateIds.length; i++) {
            if (templates[templateIds[i]].isActive) {
                active[index] = templateIds[i];
                index++;
            }
        }
        
        return active;
    }
    
    function getTemplatesByCategory(bytes32 category) external view returns (bytes32[] memory) {
        uint256 matchCount = 0;
        for (uint256 i = 0; i < templateIds.length; i++) {
            if (templates[templateIds[i]].category == category && templates[templateIds[i]].isActive) {
                matchCount++;
            }
        }
        
        bytes32[] memory matches = new bytes32[](matchCount);
        uint256 index = 0;
        for (uint256 i = 0; i < templateIds.length; i++) {
            Template storage template = templates[templateIds[i]];
            if (template.category == category && template.isActive) {
                matches[index] = templateIds[i];
                index++;
            }
        }
        
        return matches;
    }
    
    function getAllTemplates() external view returns (bytes32[] memory) {
        return templateIds;
    }
    
    // ============ Internal Functions ============
    
    function _createDefaultTemplates() internal {
        // Sports Template
        bytes32 sportsId = keccak256(abi.encodePacked("Sports Event", block.timestamp));
        templates[sportsId] = Template({
            name: "Sports Event",
            description: "Standard sports event outcome prediction",
            defaultDuration: 7 days,
            minBet: 0.01 ether,
            maxBet: 10 ether,
            category: keccak256("SPORTS"),
            requiresVerifiedCreator: false,
            isActive: true,
            createdAt: block.timestamp
        });
        templateIds.push(sportsId);
        
        // Crypto Price Template
        bytes32 cryptoId = keccak256(abi.encodePacked("Crypto Price", block.timestamp + 1));
        templates[cryptoId] = Template({
            name: "Crypto Price Prediction",
            description: "Will asset reach price target by date",
            defaultDuration: 30 days,
            minBet: 0.001 ether,
            maxBet: 5 ether,
            category: keccak256("CRYPTO"),
            requiresVerifiedCreator: false,
            isActive: true,
            createdAt: block.timestamp
        });
        templateIds.push(cryptoId);
        
        // Political Event Template
        bytes32 politicsId = keccak256(abi.encodePacked("Political Event", block.timestamp + 2));
        templates[politicsId] = Template({
            name: "Political Event",
            description: "Election or political outcome prediction",
            defaultDuration: 90 days,
            minBet: 0.01 ether,
            maxBet: 20 ether,
            category: keccak256("POLITICS"),
            requiresVerifiedCreator: true,
            isActive: true,
            createdAt: block.timestamp
        });
        templateIds.push(politicsId);
        
        // Quick Poll Template
        bytes32 pollId = keccak256(abi.encodePacked("Quick Poll", block.timestamp + 3));
        templates[pollId] = Template({
            name: "Quick Poll",
            description: "Short-term community poll",
            defaultDuration: 1 days,
            minBet: 0.001 ether,
            maxBet: 1 ether,
            category: keccak256("GENERAL"),
            requiresVerifiedCreator: false,
            isActive: true,
            createdAt: block.timestamp
        });
        templateIds.push(pollId);
    }
}
