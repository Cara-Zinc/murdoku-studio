let database;
export async function openDB() {
  if(database)return database;
  database=await new Promise((resolve,reject)=>{
    const req=indexedDB.open('murdoku-studio',1);
    req.onupgradeneeded=()=>{req.result.createObjectStore('cases',{keyPath:'id'});req.result.createObjectStore('meta',{keyPath:'id'});req.result.createObjectStore('settings');};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });return database;
}
export async function saveCase(workspace) {
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['cases','meta','settings'],'readwrite');
    tx.objectStore('cases').put(workspace);
    tx.objectStore('meta').put({id:workspace.id,title:workspace.puzzle.title,updated:Date.now(),placed:Object.keys(workspace.state.placements).length,total:workspace.puzzle.people.length});
    tx.objectStore('settings').put(workspace.id,'current');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
async function read(store,key) {
  const db=await openDB();return new Promise((resolve,reject)=>{const req=key===undefined?db.transaction(store).objectStore(store).getAll():db.transaction(store).objectStore(store).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
}
export const getCase=id=>read('cases',id);
export const listCases=()=>read('meta');
export const readSetting=key=>read('settings',key);
export async function saveSetting(key,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
export async function currentCase(){const id=await read('settings','current');return id?getCase(id):null;}
export async function deleteCase(id){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(['cases','meta'],'readwrite');for(const name of ['cases','meta'])tx.objectStore(name).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
