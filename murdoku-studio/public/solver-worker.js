import {solve} from './engine.js';
self.onmessage = ({data}) => {
  try { self.postMessage({result:solve(data.puzzle,data.fixed,2,data.maxNodes||150000)}); }
  catch (error) { self.postMessage({error:error.message}); }
};
