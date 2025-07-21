// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Treasury is Ownable {
    using SafeERC20 for IERC20;
    
    event ETHReceived(address indexed sender, uint256 amount);
    event TokenReceived(address indexed token, address indexed sender, uint256 amount);
    event ETHWithdrawn(address indexed recipient, uint256 amount);
    event TokenWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    
    constructor() {}
    
    receive() external payable {
        emit ETHReceived(msg.sender, msg.value);
    }
    
    function withdrawETH(address payable recipient, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient ETH balance");
        recipient.transfer(amount);
        emit ETHWithdrawn(recipient, amount);
    }
    
    function withdrawToken(address token, address recipient, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(recipient, amount);
        emit TokenWithdrawn(token, recipient, amount);
    }
    
    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
} 