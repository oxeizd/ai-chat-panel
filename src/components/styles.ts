import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useMemo } from 'react';

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
    
    // ===== Базовые контейнеры =====
    base: {
      normalWrapper: css`
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
      `,
      withMaxWidth: (maxWidth: number) => css`
        max-width: ${maxWidth}px;
        margin: 0 auto;
      `,
      verticalCentered: css`
        justify-content: center;
      `,
      centeredInputWrapper: css`
        display: flex;
        justify-content: center;
        width: 100%;
      `,
    },

    // ===== Приветственное сообщение =====
    welcome: {
      message: css`
        padding-left: ${theme.spacing(1)};
        font-size: 1rem;
        color: ${theme.colors.text.secondary};
        margin-bottom: ${theme.spacing(0)};
      `,
    },

    // ===== Подсказки =====
    suggestions: {
      container: css`
        display: flex;
        flex-wrap: wrap;
        gap: ${theme.spacing(1)};
        padding: ${theme.spacing(0.65)};
        z-index: 9999;
      `,
      item: css`
        background: ${theme.colors.background.secondary};
        border: 1px solid ${theme.colors.border.weak};
        border-radius: ${theme.shape.radius.default};
        padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s;
        &:hover {
          background: ${theme.colors.action.hover};
          border-color: ${theme.colors.primary.main};
        }
      `,
      popupPortal: css`
        position: fixed;
        background: ${toRgba(bgColor, 0.8)};
        backdrop-filter: blur(8px);
        border: 1px solid ${theme.colors.border.weak};
        border-radius: ${theme.shape.radius.default};
        box-shadow: ${theme.shadows.z2};
        max-height: 300px;
        overflow-y: auto;
        z-index: 21000;
        padding: ${theme.spacing(1)} ${theme.spacing(2)};
      `,
      popupHeader: css`
        font-size: 0.85rem;
        font-weight: 500;
        color: ${theme.colors.text.secondary};
        margin-bottom: ${theme.spacing(1)};
        padding-bottom: ${theme.spacing(0.5)};
      `,
      popupList: css`
        display: flex;
        flex-direction: column;
        gap: ${theme.spacing(1)};
        margin: ${theme.spacing(1)} 0;
      `,
      popupItem: css`
        display: inline-block;
        background: ${theme.colors.background.secondary};
        border: 1px solid ${theme.colors.border.weak};
        border-radius: ${theme.shape.radius.default};
        padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s;
        width: fit-content;
        max-width: 100%;
        &:hover {
          background: ${theme.colors.action.hover};
          border-color: ${theme.colors.primary.main};
        }
      `,
      popupFooter: css`
        font-size: 0.85rem;
        color: ${theme.colors.text.secondary};
        margin-top: ${theme.spacing(1)};
        padding-top: ${theme.spacing(0.5)};
        strong {
          color: ${theme.colors.text.primary};
        }
      `,
    },

    // ===== Поле ввода =====
    input: {
      container: css`
        position: static;
        display: flex;
        align-items: center;
        gap: ${theme.spacing(0.5)};
        padding: ${theme.spacing(0.75)} ${theme.spacing(0)} ${theme.spacing(1.75)};
        flex-direction: column;
        overflow: visible;
      `,
      inlineWrapper: css`
        display: flex;
        gap: ${theme.spacing(1)};
        width: 100%;
        align-items: center;
      `,
      wrapper: css`
        position: relative;
        flex: 1;
      `,
      containerHidden: css`
        opacity: 0;
        pointer-events: none;
      `,
      box: css`
        width: 100%;
        height: 38px;
      `,
      textarea: css`
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
        right: ${theme.spacing(3.2)};
        bottom: ${theme.spacing(7)};
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
      sendButtonFloating: css`
        bottom: ${theme.spacing(8)};
        right: ${theme.spacing(4)};
      `,
    },

    // ===== Шапка чата =====
    header: {
      container: css`
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: ${theme.spacing(1)} ${theme.spacing(2)};
        flex-shrink: 0;
      `,
      iconButton: css`
        width: 32px;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        background: transparent;
        border: none; 
        border-radius: ${theme.shape.radius.default};
        cursor: pointer;
      
        &:hover {
          background: ${theme.colors.action.hover};
          border: 1px solid ${theme.colors.border.weak};
        }
      
        &.fullHeight {
          height: 100%;
        }

        i,
        svg {
          width: 18px;
          height: 18px;
          display: block;
          vertical-align: middle;
          transform-origin: center;
        }

        svg rect.l1 { y: 2; height: 2; }
        svg rect.l2 { y: 10; height: 2; }
        svg rect.l3 { y: 18; height: 2; }
    `,
    },

    // ===== Сообщения =====
    messages: {
      container: css`
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
      wrapper: css`
        display: flex;
        width: 100%;
      `,
      userWrapper: css`
        justify-content: flex-end;
      `,
      aiWrapper: css`
        justify-content: flex-start;
      `,
      bubble: css`
        max-width: 70%;
        padding: ${theme.spacing(1)} ${theme.spacing(2)};
        border-radius: ${theme.shape.radius.default};
        word-break: break-word;
      `,
      userBubble: css`
        background: rgba(128, 128, 128, 0.2);
        color: ${theme.colors.primary.contrastText};
        border-bottom-right-radius: 0;
      `,
      aiBubble: css`
        color: ${theme.colors.text.primary};
        border-bottom-left-radius: 0;
      `,
    },

    // ===== Плавающее окно =====
    floating: {
      chat: css`
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
    },

    // ===== Нижние кнопки =====
    bottomButtons: {
      container: css`
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
    },

    // ===== Меню =====
    menu: {
      customMenu: css`
        z-index: 21000 !important;
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
    },
  };
};


export const useStyles = (theme: GrafanaTheme2) => {
  return useMemo(() => getStyles(theme), [theme]);
};
