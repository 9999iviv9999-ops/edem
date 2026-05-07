// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract GenesoMarketplace is Ownable, ReentrancyGuard {
    uint16 public constant MAX_FEE_BPS = 1000; // 10%

    struct Listing {
        address seller;
        address nft;
        uint256 tokenId;
        address paymentToken; // address(0) = native token
        uint256 price;
        bool active;
    }

    struct Bid {
        address bidder;
        uint256 amount;
        uint64 expiresAt;
        bool active;
    }

    uint256 public totalListings;
    uint16 public platformFeeBps;
    address public feeRecipient;

    mapping(uint256 => Listing) private listings;
    mapping(uint256 => Bid) private highestBids;

    mapping(address => uint256) private userActiveListings;
    mapping(address => uint256) private userActiveBids;
    mapping(address => uint256) private userPurchases;

    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nft,
        uint256 tokenId,
        uint256 price
    );
    event ListingCancelled(uint256 indexed listingId, address indexed seller);
    event ListingBought(uint256 indexed listingId, address indexed buyer, uint256 amount);
    event BidPlaced(uint256 indexed listingId, address indexed bidder, uint256 amount, uint64 expiresAt);
    event BidCancelled(uint256 indexed listingId, address indexed bidder);
    event BidAccepted(uint256 indexed listingId, address indexed seller, address indexed bidder, uint256 amount);
    event PlatformFeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    constructor(address initialOwner, address initialFeeRecipient, uint16 initialFeeBps) Ownable(initialOwner) {
        require(initialFeeRecipient != address(0), "fee recipient is zero");
        require(initialFeeBps <= MAX_FEE_BPS, "fee too high");
        feeRecipient = initialFeeRecipient;
        platformFeeBps = initialFeeBps;
    }

    function createListing(address nft, uint256 tokenId, uint256 price) external nonReentrant {
        require(nft != address(0), "nft is zero");
        require(price > 0, "price is zero");
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);

        totalListings += 1;
        listings[totalListings] = Listing({
            seller: msg.sender,
            nft: nft,
            tokenId: tokenId,
            paymentToken: address(0),
            price: price,
            active: true
        });
        userActiveListings[msg.sender] += 1;

        emit ListingCreated(totalListings, msg.sender, nft, tokenId, price);
    }

    function buy(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "listing inactive");
        require(msg.value == listing.price, "bad value");

        _refundAndClearBid(listingId);
        listing.active = false;
        userActiveListings[listing.seller] -= 1;
        userPurchases[msg.sender] += 1;

        uint256 feeAmount = (msg.value * platformFeeBps) / 10000;
        uint256 sellerAmount = msg.value - feeAmount;

        (bool feeSent,) = feeRecipient.call{value: feeAmount}("");
        require(feeSent, "fee transfer failed");
        (bool sellerSent,) = listing.seller.call{value: sellerAmount}("");
        require(sellerSent, "seller transfer failed");

        IERC721(listing.nft).transferFrom(address(this), msg.sender, listing.tokenId);

        emit ListingBought(listingId, msg.sender, msg.value);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "listing inactive");
        require(listing.seller == msg.sender, "not seller");

        _refundAndClearBid(listingId);
        listing.active = false;
        userActiveListings[msg.sender] -= 1;

        IERC721(listing.nft).transferFrom(address(this), msg.sender, listing.tokenId);
        emit ListingCancelled(listingId, msg.sender);
    }

    function placeBid(uint256 listingId, uint64 expiresAt) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "listing inactive");
        require(msg.value > 0, "bid is zero");
        require(expiresAt > block.timestamp, "expired bid");

        Bid storage oldBid = highestBids[listingId];
        require(msg.value > oldBid.amount, "bid too low");

        if (oldBid.active) {
            userActiveBids[oldBid.bidder] -= 1;
            (bool refunded,) = oldBid.bidder.call{value: oldBid.amount}("");
            require(refunded, "refund failed");
        }

        highestBids[listingId] = Bid({
            bidder: msg.sender,
            amount: msg.value,
            expiresAt: expiresAt,
            active: true
        });
        userActiveBids[msg.sender] += 1;

        emit BidPlaced(listingId, msg.sender, msg.value, expiresAt);
    }

    function cancelBid(uint256 listingId) external nonReentrant {
        Bid storage bid = highestBids[listingId];
        require(bid.active, "no active bid");
        require(bid.bidder == msg.sender, "not bidder");

        uint256 amount = bid.amount;
        bid.active = false;
        bid.amount = 0;
        userActiveBids[msg.sender] -= 1;

        (bool refunded,) = msg.sender.call{value: amount}("");
        require(refunded, "refund failed");

        emit BidCancelled(listingId, msg.sender);
    }

    function acceptBid(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "listing inactive");
        require(listing.seller == msg.sender, "not seller");

        Bid storage bid = highestBids[listingId];
        require(bid.active, "no active bid");
        require(bid.expiresAt >= block.timestamp, "bid expired");

        uint256 amount = bid.amount;
        address bidder = bid.bidder;

        bid.active = false;
        bid.amount = 0;
        userActiveBids[bidder] -= 1;

        listing.active = false;
        userActiveListings[msg.sender] -= 1;
        userPurchases[bidder] += 1;

        uint256 feeAmount = (amount * platformFeeBps) / 10000;
        uint256 sellerAmount = amount - feeAmount;

        (bool feeSent,) = feeRecipient.call{value: feeAmount}("");
        require(feeSent, "fee transfer failed");
        (bool sellerSent,) = listing.seller.call{value: sellerAmount}("");
        require(sellerSent, "seller transfer failed");

        IERC721(listing.nft).transferFrom(address(this), bidder, listing.tokenId);

        emit BidAccepted(listingId, msg.sender, bidder, amount);
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function getHighestBid(uint256 listingId) external view returns (Bid memory) {
        return highestBids[listingId];
    }

    function getUserStats(address user) external view returns (uint256 activeListings, uint256 activeBids, uint256 purchases) {
        return (userActiveListings[user], userActiveBids[user], userPurchases[user]);
    }

    function setPlatformFee(uint16 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "fee too high");
        uint16 oldFee = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(oldFee, newFeeBps);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "recipient is zero");
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    function _refundAndClearBid(uint256 listingId) internal {
        Bid storage bid = highestBids[listingId];
        if (!bid.active) {
            return;
        }

        address bidder = bid.bidder;
        uint256 amount = bid.amount;

        bid.active = false;
        bid.amount = 0;
        userActiveBids[bidder] -= 1;

        (bool refunded,) = bidder.call{value: amount}("");
        require(refunded, "refund failed");
    }
}
