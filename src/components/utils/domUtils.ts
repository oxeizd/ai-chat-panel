export const isElementInsideChat = (
  element: HTMLElement | null,
  chatRef: React.RefObject<HTMLElement>
): boolean => {
  if (!chatRef.current) {return false;}
  let current = element;
  while (current) {
    if (current === chatRef.current) {return true;}
    current = current.parentElement;
  }
  return false;
};
