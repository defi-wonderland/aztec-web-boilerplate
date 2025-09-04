import { AztecAddress, Fr } from "@aztec/aztec.js";

export const isValidConfig = (config: any) => {
  // Check required string fields (removed contractAddress and deploymentSalt)
  if (!config.nodeUrl || !config.tokenContractAddress || !config.dripperContractAddress || !config.deployerAddress || !config.dripperDeploymentSalt || !config.tokenDeploymentSalt) {
    return false;
  }

  // Validate Aztec addresses
  if (!AztecAddress.fromString(config.tokenContractAddress) || !AztecAddress.fromString(config.dripperContractAddress)) {
    return false;
  }

  // Validate Fr fields (removed deploymentSalt validation)
  if (!Fr.fromString(config.dripperDeploymentSalt) || !Fr.fromString(config.tokenDeploymentSalt)) {
    return false;
  }

  // Validate URL format
  const urlPattern = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;
  if (!urlPattern.test(config.nodeUrl)) {
    return false;
  }

  return true;
};