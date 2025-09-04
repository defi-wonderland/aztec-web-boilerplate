import { AztecAddress, Fr } from "@aztec/aztec.js";

export const isValidConfig = (config: any) => {
  if (!config.nodeUrl || !config.contractAddress || !config.tokenContractAddress || !config.dripperContractAddress || !config.deployerAddress || !config.deploymentSalt || !config.dripperDeploymentSalt || !config.tokenDeploymentSalt) {
    return false;
  }

  if (!AztecAddress.fromString(config.tokenContractAddress) || !AztecAddress.fromString(config.dripperContractAddress)) {
    return false;
  }

  if (!Fr.fromString(config.deploymentSalt) || !Fr.fromString(config.dripperDeploymentSalt) || !Fr.fromString(config.tokenDeploymentSalt)) {
    return false;
  }

  const urlPattern = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;
  if (!urlPattern.test(config.nodeUrl)) {
    return false;
  }

  return true;
};