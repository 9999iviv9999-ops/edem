// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract GenesoGenesis721 is ERC721URIStorage, Ownable {
    uint256 public nextTokenId = 1;
    string public baseTokenURI;

    constructor(address initialOwner, string memory name_, string memory symbol_) ERC721(name_, symbol_) Ownable(initialOwner) {}

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        baseTokenURI = newBaseURI;
    }

    function mintTo(address to, string calldata tokenUri) external onlyOwner returns (uint256 tokenId) {
        require(to != address(0), "to is zero");
        tokenId = nextTokenId;
        nextTokenId += 1;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenUri);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }
}
