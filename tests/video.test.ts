import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existingVideoComponents, validateVideoNodes } from '../packages/adapters/src/video'
import { videoFiles, videoPresets, videoWorkflow } from '@veltria/core'
import { createVideoSchema, prepareVideoSchema } from '@veltria/contracts'
describe('perfil de video revisado', () => {
  it('reconoce listas antiguas y COMBO de nodos nativos V3', () => {
    const nodes = { UNETLoader: { input: { required: { unet_name: [[videoFiles[0].filename]] } } }, CLIPLoader: { input: { required: { clip_name: [[videoFiles[1].filename]], type: [['minimax']] } } }, VAELoader: { input: { required: { vae_name: [[videoFiles[2].filename, videoFiles[3].filename]] } } }, KSamplerSelect: { input: { required: { sampler_name: ['COMBO', { options: ['res_multistep'] }] } } } }
    expect(() => validateVideoNodes(nodes)).not.toThrow()
    nodes.KSamplerSelect.input.required.sampler_name = ['COMBO', { options: ['unsupported'] }]
    expect(() => validateVideoNodes(nodes)).toThrow('perfil de video')
  })
  it('produce una receta nativa, usa la descripción literal y guarda sólo su propio MP4', () => {
    const prompt = 'Mi escena 日本語', id = crypto.randomUUID(), recipe = videoWorkflow(prompt, 'preview', 42, id)
    expect(recipe['6'].inputs.prompt).toBe(prompt)
    expect(recipe['15'].inputs.filename_prefix).toBe(`veltria_video_${id}`)
    expect(recipe['15'].inputs['format.codec']).toBe('h264')
    expect(recipe['1'].inputs.type).toBe('minimax')
    for (const preset of Object.values(videoPresets)) { expect((preset.frames - 5) % 17).toBe(0); expect(preset.width % 32).toBe(0); expect(preset.height % 32).toBe(0) }
    expect(createVideoSchema.safeParse({ requestId: id, prompt, preset: 'arbitrary' }).success).toBe(false)
    expect(prepareVideoSchema.safeParse({ revision: 'a'.repeat(64), acceptLicense: true, acceptExperimental: false }).success).toBe(false)
  })
  it('distingue cabeceras válidas, componentes ausentes y offsets fuera del archivo', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'Veltria safetensors metadata '))
    const file = videoFiles[0], parent = join(directory, 'models', file.folder), path = join(parent, file.filename)
    const header = Buffer.from(JSON.stringify({ test: { dtype: 'U8', shape: [1], data_offsets: [0, 1] } })), length = Buffer.alloc(8); length.writeBigUInt64LE(BigInt(header.length))
    try {
      await mkdir(parent, { recursive: true }); await writeFile(path, Buffer.concat([length, header, Buffer.from([42])]))
      const binding = { directory, python: '/unused/python' }
      const components = await existingVideoComponents(binding)
      expect(components[0].status).toBe('present'); expect(components[1].status).toBe('missing')
      const invalid = Buffer.from(header.toString().replace('[0,1]', '[0,9]')); await writeFile(path, Buffer.concat([length, invalid, Buffer.from([42])]))
      expect((await existingVideoComponents(binding))[0].status).toBe('invalid')
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})
