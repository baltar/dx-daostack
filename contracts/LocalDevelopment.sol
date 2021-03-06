pragma solidity ^0.5.4;

// DutchX dependencies
import "@gnosis.pm/dx-contracts/contracts/DxDevDependencies.sol";

// Price oracle
import "@gnosis.pm/dx-price-oracle/contracts/DutchXPriceOracle.sol";
// Remove WhitelistPriceOracle after the 18Feb deployement
import "@gnosis.pm/dx-price-oracle/contracts/WhitelistPriceOracle.sol";

// Universal Schemes
import "@daostack/arc/contracts/universalSchemes/SchemeRegistrar.sol";
import "@daostack/arc/contracts/universalSchemes/UpgradeScheme.sol";
import "@daostack/arc/contracts/universalSchemes/GlobalConstraintRegistrar.sol";
import "@daostack/arc/contracts/universalSchemes/ContributionReward.sol";
import "@daostack/arc/contracts/universalSchemes/GenericScheme.sol";
import "@daostack/infra/contracts/votingMachines/GenesisProtocol.sol";

// Tokens
import "../test/contracts/GenToken.sol";

/* solium-disable-next-line no-empty-blocks */
contract LocalDevelopment {}
