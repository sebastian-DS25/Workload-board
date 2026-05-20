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

export function defaultBoardPayload() {
  return {
    assignments: initAssignments(),
    title: DEFAULT_TITLE,
    comments: initComments(),
  };
}

export function applyParsedState(parsed) {
  return {
    assignments: parsed?.assignments || initAssignments(),
    title: parsed?.title || DEFAULT_TITLE,
    comments: { ...initComments(), ...(parsed?.comments || {}) },
  };
}
