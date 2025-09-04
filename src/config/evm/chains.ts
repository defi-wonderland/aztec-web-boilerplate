import { Chain, baseSepolia } from "viem/chains";

export const EVM_CHAINS= [
  baseSepolia,
];

export const DEFAULT_EVM_CHAIN = baseSepolia;

export const getEVMChainById = (id: number) => {
  return EVM_CHAINS.find(chain => chain.id === id);
};

export const getEVMChainByName = (name: string): Chain | undefined => {
  return EVM_CHAINS.find(chain => chain.name.toLowerCase() === name.toLowerCase());
};
