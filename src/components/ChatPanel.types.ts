// ChatPanel.types.ts
export interface Message {
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

export interface ChatStyle {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  width: number;
}
