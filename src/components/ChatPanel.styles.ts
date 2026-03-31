// ChatPanel.styles.ts
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

const toRgba = (color: string, alpha: number) => {
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
};

export const getStyles = (theme: GrafanaTheme2) => {
  const bgColor = theme.colors.background.primary;
  return {
    normalWrapper: css`
      display: flex;
      flex-direction: column;
      background: ${theme.colors.background.primary};
      width: 100%;
      height: 100%;
    `,
    inputContainer: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(0.5)};
      padding: ${theme.spacing(0.75)};
    `,
    inputBox: css`
      flex: 1;
      height: 38px;
    `,
    inputContainerHidden: css`
      opacity: 0;
      pointer-events: none;
    `,
    floatingChat: css`
      position: fixed;
      background: ${toRgba(bgColor, 0.8)};
      backdrop-filter: blur(8px);
      border-radius: ${theme.shape.radius.default};
      box-shadow: ${theme.shadows.z3};
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 1000;
      width: 100%;
      isolation: isolate;
    `,
    chatMessagesContainer: css`
      flex: 1;
      overflow-y: auto;
      padding: ${theme.spacing(2)};
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
      min-height: 0;
      scrollbar-width: thin;
      scrollbar-color: ${theme.colors.border.weak} transparent;
      &::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background: ${theme.colors.border.weak};
        border-radius: 3px;
      }
      &::-webkit-scrollbar-thumb:hover {
        background: ${theme.colors.text.disabled};
      }
    `,
    messageWrapper: css`
      display: flex;
      width: 100%;
    `,
    userMessageWrapper: css`
      justify-content: flex-end;
    `,
    aiMessageWrapper: css`
      justify-content: flex-start;
    `,
    messageBubble: css`
      max-width: 70%;
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
      border-radius: ${theme.shape.radius.default};
      word-break: break-word;
    `,
    userMessageBubble: css`
      background: rgba(128, 128, 128, 0.2);
      color: ${theme.colors.primary.contrastText};
      border-bottom-right-radius: 0;
    `,
    aiMessageBubble: css`
      color: ${theme.colors.text.primary};
      border-bottom-left-radius: 0;
    `,
    chatHeader: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
      flex-shrink: 0;
    `,
    chatInputWrapper: css`
      position: relative;
      margin: ${theme.spacing(2)};
      flex-shrink: 0;
    `,
    chatTextarea: css`
      resize: none;
      width: 100%;
      min-height: 72px;
      max-height: 120px;
      font-family: inherit;
      font-size: 0.875rem;
      line-height: 1.4;
      padding: ${theme.spacing(1)} ${theme.spacing(5)} ${theme.spacing(1)} ${theme.spacing(1)};
      background: ${theme.colors.background.primary}CC;
      backdrop-filter: blur(10px);
      border: 1px solid ${theme.colors.border.medium};
      border-radius: ${theme.shape.radius.default};
      color: ${theme.colors.text.primary};
      &:focus {
        outline: none;
        border-color: ${theme.colors.primary.main};
      }
    `,
    sendButton: css`
      position: absolute;
      right: ${theme.spacing(1)};
      bottom: ${theme.spacing(2)};
      width: 32px;
      height: 32px;
      padding: 0;
      border-radius: ${theme.shape.radius.circle};
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: ${theme.colors.background.primary}CC;
      border: 1px solid ${theme.colors.border.weak};
      cursor: pointer;
      &:hover {
        background: ${theme.colors.action.hover};
      }
      i,
      svg {
        font-size: 18px;
        font-weight: 600;
      }
    `,
    customMenu: css`
      z-index: 20000 !important;
      background: ${theme.colors.background.primary};
      min-width: 200px;
      max-height: 300px;
      overflow-y: auto;
      overscroll-behavior: contain;
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
      [class*='menu-item'] {
        padding: 1px 12px;
        text-align: left;
        font-size: 0.7rem;
        line-height: 1.2;
      }
    `,
    iconButton: css`
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      background: ${theme.colors.background.primary}CC;
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
      cursor: pointer;
      &:hover {
        background: ${theme.colors.action.hover};
      }
      i,
      svg {
        font-size: 18px;
        font-weight: 600;
      }
    `,
    bottomButtons: css`
      display: flex;
      gap: ${theme.spacing(1)};
      padding: ${theme.spacing(1)} ${theme.spacing(2)} ${theme.spacing(2)} ${theme.spacing(2)};
      flex-shrink: 0;
    `,
    agentButton: css`
      flex: 1;
      justify-content: space-between;
      background: ${theme.colors.background.primary}CC;
      border: 1px solid ${theme.colors.border.weak};
    `,
    newChatButton: css`
      flex-shrink: 0;
      background: ${theme.colors.background.primary}CC;
      border: 1px solid ${theme.colors.border.weak};
    `,
  };
};
