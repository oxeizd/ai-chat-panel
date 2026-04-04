import React from "react";
import { PanelProps } from "@grafana/data";
import { PanelOptions, AgentConfig } from "types";
import { InlineChat } from "./ui/chat/InlineChat";
import { FloatingChatPanel } from "./ui/chat/FloatingChatPanel";
import { ButtonChatPanel } from "./ui/chat/ButtonChatPanel";
import { ChatProvider } from "./ui/core/chatConfig";
import { DEFAULT_PLACEHOLDER } from "./ui/core/config";

interface Props extends PanelProps<PanelOptions> {}

export const ChatPanel: React.FC<Props> = ({ options }) => {
  const chatMode = options.chatMode ?? 'floating';
  const placeholderText = options.placeholderText?.trim() || DEFAULT_PLACEHOLDER;
  const agents: AgentConfig[] = options.agents?.length ? options.agents : [];

  const renderChat = () => {
    switch (chatMode) {
      case 'inline':
        return <InlineChat />;
      case 'button':
        return <ButtonChatPanel />;
      default:
        return <FloatingChatPanel />;
    }
  };

  return (
    <ChatProvider
      agents={agents}
      placeholderText={placeholderText}
      suggestions={options.suggestions}
      suggestionsPlacement={options.suggestionsPlacement}
      showSuggestions={options.showSuggestions}
      maxWidth={options.maxWidth}
      centerInput={options.centerInput}
      welcomeMessage={options.welcomeMessage}
      showWelcomeMessage={options.showWelcomeMessage}
      debug={options.debug ?? false}
      buttonText={options.buttonText}
      openFullscreen={options.openFullscreen}
      centerFloatingChat={options.centerFloatingChat}
    >
      {renderChat()}
    </ChatProvider>
  );
};