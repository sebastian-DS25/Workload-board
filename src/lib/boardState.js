import { PEOPLE, CATEGORIES, DEFAULT_TITLE } from "./constants.js";

export function initAssignments() {
  return PEOPLE.reduce((acc, person) => {
    acc[person] = CATEGORIES.reduce((inner, cat) => {
      inner[cat] = false;
      return inner;
    }, {});
    return acc;
  }, {});
}

export function initComments() {
  return PEOPLE.reduce((acc, person) => {
    acc[person] = "";
    return acc;
  }, {});
}

export function initEmailCounts() {
  return CATEGORIES.reduce((acc, cat) => {
    acc[cat] = 0;
    return acc;
  }, {});
}

export function initOooStatus() {
  return PEOPLE.reduce((acc, person) => {
    acc[person] = false;
    return acc;
  }, {});
}

export function defaultBoardPayload() {
  return {
    assignments: initAssignments(),
    title: DEFAULT_TITLE,
    comments: initComments(),
    emailCounts: initEmailCounts(),
    oooStatus: initOooStatus(),
  };
}

export function applyParsedState(parsed) {
  return {
    assignments: parsed?.assignments || initAssignments(),
    title: parsed?.title || DEFAULT_TITLE,
    comments: { ...initComments(), ...(parsed?.comments || {}) },
    emailCounts: { ...initEmailCounts(), ...(parsed?.emailCounts || {}) },
    oooStatus: { ...initOooStatus(), ...(parsed?.oooStatus || {}) },
    coordinator: parsed?.coordinator ?? null,
    lastReset: parsed?.lastReset ?? null,
  };
}
