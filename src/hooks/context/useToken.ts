import { useContext } from "react";
import { TokenContext, TokenContextType } from "../../providers/TokenProvider";

export const useToken = (): TokenContextType => {
  const context = useContext(TokenContext); 
  if (context === undefined) {
    throw new Error('useToken must be used within a TokenProvider');
  }
  return context;
};