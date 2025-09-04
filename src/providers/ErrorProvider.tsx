import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface MessageInfo {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  timestamp: Date;
  source?: string; // e.g., 'voting', 'dripper', 'wallet'
  details?: string;
}

// Keep backwards compatibility
export type ErrorInfo = MessageInfo;

interface ErrorContextType {
  messages: MessageInfo[];
  addMessage: (message: Omit<MessageInfo, 'id' | 'timestamp'>) => void;
  clearMessage: (id: string) => void;
  clearAllMessages: () => void;
  hasMessages: boolean;
  latestMessage: MessageInfo | null;
  
  // Backwards compatibility
  errors: MessageInfo[];
  addError: (error: Omit<MessageInfo, 'id' | 'timestamp'>) => void;
  clearError: (id: string) => void;
  clearAllErrors: () => void;
  hasErrors: boolean;
  latestError: MessageInfo | null;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

interface ErrorProviderProps {
  children: ReactNode;
}

export const ErrorProvider: React.FC<ErrorProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<MessageInfo[]>([]);

  const addMessage = (message: Omit<MessageInfo, 'id' | 'timestamp'>) => {
    const newMessage: MessageInfo = {
      ...message,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    
    setMessages(prev => [newMessage, ...prev.slice(0, 4)]); // Keep only last 5 messages
  };

  const clearMessage = (id: string) => {
    setMessages(prev => prev.filter(message => message.id !== id));
  };

  const clearAllMessages = () => {
    setMessages([]);
  };

  const hasMessages = messages.length > 0;
  const latestMessage = messages[0] || null;

  const contextValue: ErrorContextType = {
    messages,
    addMessage,
    clearMessage,
    clearAllMessages,
    hasMessages,
    latestMessage,
    
    // Backwards compatibility
    errors: messages,
    addError: addMessage,
    clearError: clearMessage,
    clearAllErrors: clearAllMessages,
    hasErrors: hasMessages,
    latestError: latestMessage,
  };

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useError = (): ErrorContextType => {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};
