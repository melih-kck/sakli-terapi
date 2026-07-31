export const handleTabListKeyDown = (event) => {
  const tabList = event.currentTarget.closest('[role="tablist"]');
  if (!tabList) return;

  const orientation = tabList.getAttribute('aria-orientation') || 'horizontal';
  const previousKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
  const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
  if (![previousKey, nextKey, 'Home', 'End'].includes(event.key)) return;

  const tabs = [...tabList.querySelectorAll('[role="tab"]:not(:disabled)')];
  const currentIndex = tabs.indexOf(event.currentTarget);
  if (currentIndex < 0 || tabs.length === 0) return;

  event.preventDefault();
  let nextIndex;
  if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabs.length - 1;
  else if (event.key === nextKey) nextIndex = (currentIndex + 1) % tabs.length;
  else nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;

  tabs[nextIndex].focus();
  tabs[nextIndex].click();
};
