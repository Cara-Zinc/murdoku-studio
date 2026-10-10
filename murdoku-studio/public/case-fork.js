import {clone} from './engine.js';

export function forkWorkspace(current, id, title) {
  const puzzle=clone(current.puzzle);
  puzzle.id=id;
  puzzle.title=title;
  const book=current.book?clone({...current.book,sheets:{}}):null;
  return {
    id,
    puzzle,
    state:clone(current.state),
    undo:[],
    redo:[],
    view:current.view?clone(current.view):undefined,
    book,
  };
}
