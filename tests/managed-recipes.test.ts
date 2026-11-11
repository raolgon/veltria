import { test, expect } from 'vitest'
import windows from '../packages/core/src/managed/win.json'
import linux from '../packages/core/src/managed/linux.json'
test('the Windows NVIDIA recipe pins compatible CUDA wheels rather than PyPI CPU wheels', () => {
  for (const name of ['torch', 'torchvision', 'torchaudio']) {
    const wheel = windows.wheels.find(w => w.filename.startsWith(name + '-'))!
    expect(wheel.filename).toMatch(/\+cu126-cp312-cp312-win_amd64\.whl$/)
    expect(['download.pytorch.org','download-r2.pytorch.org']).toContain(new URL(wheel.url).hostname)
    const version = wheel.filename.split('-')[1]
    expect(windows.requirements).toContain(`${name}==${version} --hash=sha256:${wheel.sha256}`)
  }
  expect(windows.id).not.toBe('comfy-0.35.0-py312-torch271-win-v1')
})
test('all locked artifacts have integrity metadata and every wheel has an offline hash requirement', () => {
  for (const recipe of [windows,linux]) {
    const artifacts=[recipe.python,recipe.uv,recipe.comfy,...recipe.wheels]
    expect(new Set(artifacts.map(w=>w.filename)).size).toBe(artifacts.length)
    for (const artifact of artifacts) {
      expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(artifact.bytes).toBeGreaterThan(0)
      expect(new URL(artifact.url).protocol).toBe('https:')
    }
    for(const wheel of recipe.wheels) expect(recipe.requirements).toContain(`--hash=sha256:${wheel.sha256}`)
  }
})
