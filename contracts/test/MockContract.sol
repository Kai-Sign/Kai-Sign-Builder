// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract MockContract {
    string public name = "Mock Contract for ERC7730 Testing";
    uint256 public version = 1;
    mapping(address => uint256) public balances;
    
    event ValueSet(uint256 newValue);
    event BalanceUpdated(address indexed user, uint256 newBalance);
    
    function setValue(uint256 _value) external {
        version = _value;
        emit ValueSet(_value);
    }
    
    function setBalance(address user, uint256 amount) external {
        balances[user] = amount;
        emit BalanceUpdated(user, amount);
    }
    
    function getContractInfo() external view returns (string memory, uint256) {
        return (name, version);
    }
    
    // Function to make the contract have code (for extcodesize checks)
    function hasCode() external pure returns (bool) {
        return true;
    }
} 