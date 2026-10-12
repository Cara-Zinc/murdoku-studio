import {solve} from './engine.js';
import {setLanguage} from './i18n.js';
self.onmessage = ({data}) => {
  setLanguage(data.language);
  try { self.postMessage({result:solve(data.puzzle,data.fixed,2,data.maxNodes||150000)}); }
  catch (error) { self.postMessage({error:error.message}); }
};
