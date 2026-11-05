// Isolated lower-version fixture only: reproduce the pre-consolidation profile
// and singleton behavior with current business code, never a production switch.
import path from 'node:path'
export function initializeStorage(app, config) {
  const legacy = path.join(app.getPath('appData'), config.dataDirectory)
  app.setPath('userData', legacy)
  app.setPath('sessionData', legacy)
  return app.requestSingleInstanceLock()
}
