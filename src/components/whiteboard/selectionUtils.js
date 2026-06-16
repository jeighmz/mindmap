export function isItemInSelection(selectedIds, itemId) {
  if (!selectedIds || selectedIds.size === 0) return false;
  return [...selectedIds].some((id) => String(id) === String(itemId));
}
