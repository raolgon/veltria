"""Maintainer-only: resolve metadata with uv first, then pin one wheel per package.
Never used by the product installer. Does not download model weights or wheels.
"""
import hashlib, json, pathlib, tomllib, urllib.request
from urllib.parse import unquote

ROOT = pathlib.Path(__file__).resolve().parents[1] / 'packages/core/src/managed'
def get(url):
    with urllib.request.urlopen(url) as r:
        return r.read()
def asset(repo, tag, name):
    release = json.loads(get(f'https://api.github.com/repos/{repo}/releases/tags/{tag}'))
    a = next(a for a in release['assets'] if a['name'] == name)
    assert a['digest'].startswith('sha256:')
    return dict(filename=name, url=a['browser_download_url'], bytes=a['size'], sha256=a['digest'][7:])
licenses={}
def license_for(name, version):
    key=(name,version)
    if key not in licenses:
        public_version=version.split('+',1)[0]
        info=json.loads(get(f'https://pypi.org/pypi/{name}/{public_version}/json'))['info']
        value=info.get('license_expression') or info.get('license') or 'See provider license'
        # The provider page retains full terms; keep the review summary readable.
        licenses[key]=f"{name} {version}: {value.splitlines()[0][:160]} · https://pypi.org/project/{name}/{public_version}/"
    return licenses[key]

source_url = 'https://codeload.github.com/Comfy-Org/ComfyUI/tar.gz/refs/tags/v0.35.0'
source = get(source_url)
comfy = dict(filename='comfy-v0.35.0.tar.gz', url=source_url, bytes=len(source), sha256=hashlib.sha256(source).hexdigest())
for platform, triple in [('linux', 'x86_64-unknown-linux-gnu'), ('win', 'x86_64-pc-windows-msvc')]:
    lock = tomllib.loads(pathlib.Path(f'/tmp/pylock.veltria-{platform}.toml').read_text())
    wheels=[]
    requirements=[]
    for p in lock['packages']:
        assert p.get('wheels'), p
        # uv's target-specific compile filters incompatible wheels; prefer native over universal.
        w=p['wheels'][0]
        filename=unquote(w['url'].rsplit('/',1)[1])
        if platform == 'win' and p['name'] in ['torch', 'torchvision', 'torchaudio']:
            assert '+cu126-' in filename, 'Resolve Windows against the official CUDA 12.6 index; PyPI Windows wheels are CPU-only.'
        wheels.append(dict(filename=filename,url=w['url'],bytes=w['size'],sha256=w['hashes']['sha256']))
        requirements.append(f"{p['name']}=={p['version']} --hash=sha256:{w['hashes']['sha256']}")
    recipe_id='comfy-0.35.0-py312-torch271-cu126-win-v2' if platform=='win' else 'comfy-0.35.0-py312-torch271-linux-v1'
    manifest=dict(id=recipe_id, platform='win32' if platform=='win' else 'linux', arch='x64',
        comfy=comfy, python=asset('astral-sh/python-build-standalone','20251014',f'cpython-3.12.12+20251014-{triple}-install_only.tar.gz'),
        uv=asset('astral-sh/uv','0.11.3',f'uv-{triple}.'+('zip' if platform=='win' else 'tar.gz')),
        wheels=wheels, requirements='\n'.join(requirements)+'\n',
        licenses=['ComfyUI: GPL-3.0 · https://github.com/Comfy-Org/ComfyUI/blob/v0.35.0/LICENSE', 'Python: PSF-2.0 · https://docs.python.org/3.12/license.html', 'uv: MIT/Apache-2.0 · https://github.com/astral-sh/uv/tree/0.11.3', *[license_for(p['name'],p['version']) for p in lock['packages']]])
    if platform == 'win':
        manifest['licenses'].append('PyTorch CUDA wheels: see the package and bundled third-party licenses · https://download.pytorch.org/whl/cu126')
    (ROOT/f'{platform}.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(platform,len(wheels),'wheels',sum(w['bytes'] for w in wheels),'bytes')
