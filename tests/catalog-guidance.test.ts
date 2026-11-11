import { test, expect } from 'vitest'
import type { Catalog } from '@veltria/contracts'
import { verifiedChoice, localPriority, purpose } from '../apps/ui/src/catalog-guidance'
function fixture() {
  return {selectedModelId:'model',selectedConfigurationId:'square',configurations:[{id:'square',configuration:{parameters:{format:'square'}}},{id:'wide',configuration:{parameters:{format:'landscape'}}}],models:[{profile:{id:'model'},status:'prepared',recommendation:{level:'recommended',verified:true,evidenceDetails:{width:512,height:512}}}]} as unknown as Catalog
}
test('catalog evidence applies only to the selected configuration and actual output dimensions',()=>{
  const catalog=fixture(), model=catalog.models[0]
  expect(verifiedChoice(model,'square',catalog)).toBe(true)
  expect(verifiedChoice(model,'wide',catalog)).toBe(false)
  catalog.selectedConfigurationId='wide'
  expect(verifiedChoice(model,'wide',catalog)).toBe(false)
  model.recommendation.evidenceDetails={at:'today',width:512,height:384}
  expect(verifiedChoice(model,'wide',catalog)).toBe(true)
})
test('recommendations prioritize ready options and do not invent a community model specialty',()=>{
  const catalog=fixture(), model=catalog.models[0]
  expect(localPriority(model,'square',catalog)).toBe(0)
  expect(localPriority({...model,status:'missing',recommendation:{...model.recommendation,verified:false}},'square',catalog)).toBeGreaterThan(localPriority({...model,recommendation:{...model.recommendation,verified:false}},'square',catalog))
  expect(purpose('unknown-model',false)).toContain('descripción del autor')
  expect(purpose('unknown-model',true)).toContain('modelo base')
})
