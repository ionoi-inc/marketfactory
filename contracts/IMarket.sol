// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IMarket
 * @notice Interface for prediction market contracts
 */
interface IMarket {
    function initialize(
        string calldata question,
        string calldata description,
        uint256 endTime,
        address resolver,
        uint256 minBet,
        uint256 maxBet,
        bytes calldata extraData
    ) external;
    
    function placeBet(bool outcome, uint256 amount) external payable;
    
    function resolve(bool outcome) external;
    
    function cancel() external;
    
    function claim() external;
    
    function getQuestion() external view returns (string memory);
    
    function getEndTime() external view returns (uint256);
    
    function getTotalVolume() external view returns (uint256);
    
    function isResolved() external view returns (bool);
}
