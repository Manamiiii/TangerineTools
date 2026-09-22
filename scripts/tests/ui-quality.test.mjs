import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const fixture = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CatalogTool } from '/src/components/dataTables.jsx';
import { OwnedTool } from '/src/components/owned.jsx';
import { Modal, SearchableSelect } from '/src/components/common.jsx';
import '/src/styles.css';
const h = React.createElement;
function Fixture() {
  const [open, setOpen] = useState(false), [child, setChild] = useState(false), [busy, setBusy] = useState(false);
  if (location.hash === '#catalog') return h(CatalogTool, {scene:{id:'s'}});
  if (location.hash === '#owned') return h(OwnedTool, {scene:{id:'s'}});
  return h(React.Fragment, null,
    h('button', {id:'open', onClick:()=>setOpen(true)}, '打开'),
    open && h(Modal, {title:'父窗口', busy, onClose:()=>setOpen(false)},
      h('button', {id:'child', onClick:()=>setChild(true)}, '子窗口'),
      h('button', {id:'busy', onClick:()=>setBusy(!busy)}, '忙碌开关'),
      h(SearchableSelect, {options:[{value:'a',label:'A'}], value:'a', onChange:()=>{}}),
      h('button', {id:'last'}, '末尾'),
      child && h(Modal, {title:'子窗口', onClose:()=>setChild(false)}, h('button', null, '子内容'))));
}
createRoot(document.getElementById('root')).render(h(Fixture));
`

test('dialogs retain focus, close only the top layer, and OCR runs without external requests', { timeout: 90000 }, async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{
    name: 'quality-test-fixture',
    resolveId(id) { if (id === 'virtual:quality-fixture') return id },
    load(id) { if (id === 'virtual:quality-fixture') return fixture },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/__quality') return next()
        res.setHeader('Content-Type', 'text/html')
        res.end(await server.transformIndexHtml('/__quality', '<html><body><div id="root"></div><script type="module" src="/@id/virtual:quality-fixture"></script></body></html>'))
      })
    },
  }] })
  let browser
  try {
    await server.listen()
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const page = await browser.newPage()
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`
    const external = []
    await page.route('**/*', route => {
      if (!route.request().url().startsWith(origin)) { external.push(route.request().url()); return route.abort() }
      return route.continue()
    })
    await page.goto(`${origin}/__quality`)
    await page.locator('#open').click()
    await page.locator('#child').click()
    assert.equal(await page.getByRole('dialog').count(), 2)
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 1)
    assert.equal(await page.evaluate(() => document.activeElement.id), 'child')
    await page.locator('#last').focus()
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), '关闭')
    await page.getByRole('combobox').click()
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 1)
    await page.locator('#busy').click()
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 1)
    assert.equal(await page.getByRole('button', { name: '关闭', exact: true }).isDisabled(), true)
    await page.locator('#busy').click()
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert.equal(await page.evaluate(() => document.activeElement.id), 'open')
    const text = await page.evaluate(async () => {
      const { recognizeNumericImageText } = await import('/src/features/ocr/localOcr.js')
      const canvas = document.createElement('canvas')
      canvas.width = 320; canvas.height = 90
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 320, 90)
      ctx.fillStyle = 'black'; ctx.font = '60px Arial'; ctx.fillText('12345', 15, 65)
      return recognizeNumericImageText(canvas.toDataURL())
    })
    assert.match(text.replaceAll(' ', ''), /12345/)
    assert.deepEqual(external, [])
    await page.evaluate(async () => {
      const { db } = await import('/src/db.js')
      await db.scenes.put({id:'s', name:'Test', type:'generic'})
      await db.catalogTables.bulkPut([{id:'c',sceneId:'s',name:'Catalog',order:0},{id:'o',sceneId:'s',name:'Owned',kind:'owned',collectionMode:'multiple'}])
      await db.catalogFields.bulkPut([{id:'cn',tableId:'c',key:'name',type:'text',name:'名称',order:0},{id:'on',tableId:'o',key:'name',type:'text',name:'名称',order:0},{id:'hidden',tableId:'o',key:'secret',type:'text',name:'隐藏备注',hidden:true,order:1}])
      await db.catalogRows.bulkPut([...Array.from({length:21},(_,i)=>({id:'c'+String(i).padStart(2,'0'),tableId:'c',values:{name:'Item '+i}})),{id:'owned',tableId:'o',values:{name:'Owned item',secret:'Hidden detail survives'}}])
    })
    await page.goto(`${origin}/__quality#catalog`)
    await page.reload()
    await page.getByRole('button', {name:'最后一页',exact:true}).click()
    await page.getByRole('button', {name:'删除',exact:true}).click()
    await page.getByRole('dialog').getByRole('button', {name:'删除',exact:true}).click()
    await page.waitForFunction(() => document.querySelector('input[aria-label="输入页码"]')?.value === '1')
    assert.equal(await page.locator('.data-grid tbody tr').count(), 20)
    await page.goto(`${origin}/__quality#owned`)
    await page.reload()
    await page.getByRole('button', {name:'详情',exact:true}).click()
    assert.match(await page.getByRole('dialog').innerText(), /Hidden detail survives/)

  } finally {
    await browser?.close()
    await server.close()
  }
})
