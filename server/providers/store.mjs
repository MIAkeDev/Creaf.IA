import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateProvider } from '../../shared/provider-validation.mjs';
import { stampProviderPrices } from '../../shared/pricing.mjs';

// Replace this adapter when moving to PostgreSQL. No frontend imports this file.
export function createProviderStore(file = new URL('../../data/providers.json', import.meta.url)) {
  let queue = Promise.resolve();
  async function list() {
    let raw;
    try { raw = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return []; throw new Error('No se pudo leer el catálogo de proveedores.', { cause: error }); }
    if (!Array.isArray(raw)) throw new Error('El catálogo no contiene una lista.');
    let records;
    try { records = raw.map(validateProvider); } catch (error) { throw new Error('El catálogo contiene registros no válidos.', { cause: error }); }
    if (new Set(records.map(record => record.id)).size !== records.length) throw new Error('IDs de proveedores duplicados.');
    return records;
  }
  function mutate(operation) {
    const task = queue.then(async () => {
      const records = await list(); const result = operation(records);
      const path = file instanceof URL ? (await import('node:url')).fileURLToPath(file) : file;
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${randomUUID()}.tmp`;
      try { await writeFile(temporary, JSON.stringify(records, null, 2) + '\n', 'utf8'); await rename(temporary, path); }
      finally { await unlink(temporary).catch(() => {}); }
      return result;
    });
    queue = task.catch(() => {}); return task;
  }
  return {
    list,
    create(value) { return mutate(records => { const provider = stampProviderPrices(validateProvider({ ...value, id: randomUUID() })); records.push(provider); return provider; }); },
    update(id, value) { return mutate(records => { const index = records.findIndex(record => record.id === id); if (index < 0) return null; const provider = stampProviderPrices(validateProvider({ ...value, id }), records[index]); records[index] = provider; return provider; }); },
    remove(id) { return mutate(records => { const index = records.findIndex(record => record.id === id); if (index < 0) return false; records.splice(index, 1); return true; }); },
  };
}
