import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const shellSource = readFileSync(
  new URL('../src/features/admin/components/AdminShell.tsx', import.meta.url),
  'utf8',
)
const pageSource = readFileSync(
  new URL('../src/features/admin/pages/AdminFollowUpsPage.tsx', import.meta.url),
  'utf8',
)

test('Admin My Follow-ups is routed inside the existing Admin shell', () => {
  assert.match(appSource, /path="\/admin\/follow-ups"/)
  assert.match(shellSource, /to="\/admin\/follow-ups"/)
  assert.match(shellSource, /המעקב שלי/)
  assert.match(pageSource, /<AdminShell>/)
})
test('follow-up UI keeps Admin state and restaurant contact state distinct', () => {
  assert.match(pageSource, /לא תועד קשר מצד המסעדה/)
  assert.match(pageSource, /מעקב קשר אינו זמין להגשת Job Board/)
  assert.match(pageSource, /המידע כאן אינו משנה את סטטוס המועמדות/)
  assert.match(pageSource, /markContactNow/)
  assert.match(pageSource, /הסכמה לשמוע על הזדמנויות נוספות/)
})
