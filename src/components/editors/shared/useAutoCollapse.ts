import { useEffect, useRef, useState } from 'react';

/**
 * Управляет состоянием "свёрнуто/развёрнуто" для секций-опций, включаемых
 * чекбоксом (Streaming/Polling/Reasoning/History и т.д. в редакторе агента).
 *
 * Поведение:
 * - Если функция УЖЕ была включена в момент монтирования (редактируем
 *   существующий, уже настроенный агент/эндпоинт) — секция стартует
 *   свёрнутой, чтобы не загромождать форму деталями по умолчанию.
 * - Если функция только что включена в текущей сессии редактирования
 *   (пользователь только сейчас поставил галочку) — секция автоматически
 *   разворачивается, чтобы можно было сразу заполнить параметры.
 * - Ручное сворачивание/разворачивание через toggle() запоминается до
 *   следующего перехода "выключено -> включено".
 */
export function useAutoCollapse(enabled: boolean) {
  const wasEnabledOnMountRef = useRef(enabled);
  const prevEnabledRef = useRef(enabled);
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!prevEnabledRef.current && enabled) {
      setManualCollapsed(false);
    }
    prevEnabledRef.current = enabled;
  }, [enabled]);

  const collapsed = manualCollapsed !== null ? manualCollapsed : wasEnabledOnMountRef.current;

  const toggle = () => setManualCollapsed(!collapsed);

  return [collapsed, toggle] as const;
}
