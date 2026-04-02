export const isElementInsideChat = (element: HTMLElement | null, chatElement: HTMLElement | null): boolean => {
  if (!chatElement) {
    return false;
  }
  let current = element;
  while (current) {
    if (current === chatElement) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};
