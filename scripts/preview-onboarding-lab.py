"""Run the packaged UI against fresh real Veltria-Lab data; never installs models."""
import pathlib, secrets, subprocess, sys, tarfile

repo = pathlib.Path(__file__).resolve().parents[1]
wsl = '/mnt/c/Windows/System32/wsl.exe'
base = '/home/veltria/lab/acceptance-hito3-20261110' if '--acceptance' in sys.argv else '/home/veltria/lab/welcome3-20261109'
def lab(*args, **kw):
    return subprocess.run([wsl, '-d', 'Veltria-Lab', '-u', 'veltria', '--exec', *args], check=True, **kw)
lab('mkdir', '-p', base)
archive = repo / 'build/lab/onboarding.tar'
with tarfile.open(archive, 'w') as tar:
    tar.add(repo / 'build/browser/0.10.0', arcname='app')
with archive.open('rb') as stream:
    lab('tar', '-xf', '-', '-C', base, stdin=stream)
lab('chmod', '700', base + '/app/veltria-web', base + '/app/resources/service/veltria-service')
if '--prepare-only' in sys.argv:
    print('Updated isolated lab package; no service started.')
    sys.exit(0)
process = subprocess.Popen([wsl, '-d', 'Veltria-Lab', '-u', 'veltria', '--exec', 'env', 'VELTRIA_DATA_DIR=' + base + '/data-' + secrets.token_hex(4), base + '/app/veltria-web'])
try:
    process.wait()
except KeyboardInterrupt:
    process.terminate()
