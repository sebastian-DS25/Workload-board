const EDIT_KEY = import.meta.env.VITE_EDIT_KEY?.trim() || "";

export function getAccessMode() {
  const params = new URLSearchParams(window.location.search);
  const isView = params.get("mode") === "view";
  const keyOk = !EDIT_KEY || params.get("key") === EDIT_KEY;
  return {
    isView,
    canEdit: !isView && keyOk,
    needsEditKey: !!EDIT_KEY,
  };
}

export function buildShareUrls() {
  const base = window.location.origin + window.location.pathname;
  const viewUrl = `${base}?mode=view`;
  const editUrl = EDIT_KEY
    ? `${base}?key=${EDIT_KEY}`
    : base;
  return { viewUrl, editUrl };
}

export function copyText(text) {
  return navigator.clipboard.writeText(text);
}
