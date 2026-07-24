// 数据层兼容入口。组件继续从这里导入，具体实现按职责拆在 src/db/ 下。

export { db } from './db/core.js'
export { EXPORT_SCHEMA_VERSION, exportAllData, importAllData, validateImportPayload } from './db/importExport.js'
export { ensureSeeded } from './db/rockKingdomSeed.js'
export { getReadingState, saveReadingState } from './db/readingState.js'
export {
  createCatalogTable,
  createField,
  createRow,
  createScene,
  deleteCatalogTable,
  deleteField,
  deleteRow,
  deleteScene,
  ensureOwnedTable,
  renameCatalogTable,
  reorderFields,
  updateField,
  updateRow,
  updateScene,
} from './db/repository.js'
