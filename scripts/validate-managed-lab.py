"""Opt-in real install/inference in the isolated Veltria-Lab distro.
Requires the user's authorization for the exact plan. No external engine is modified.
Run from Ubuntu's Python with --authorize-managed-lab after building build/lab/veltria-service.
"""
import argparse, http.cookiejar, json, pathlib, secrets, struct, subprocess, tarfile, time, urllib.request, uuid

parser=argparse.ArgumentParser()
parser.add_argument('--authorize-managed-lab', action='store_true', required=True)
args=parser.parse_args()
repo=pathlib.Path(__file__).resolve().parents[1]
wsl='/mnt/c/Windows/System32/wsl.exe'
base='/home/veltria/lab/hito3-20261109'
control=secrets.token_hex(32)
def lab(*command, **kw):
    return subprocess.run([wsl,'-d','Veltria-Lab','-u','veltria','--exec',*command],check=True,**kw)
lab('mkdir','-p',base+'/data')
archive=repo/'build/lab/transfer.tar'
with tarfile.open(archive,'w') as tar:
    tar.add(repo/'build/lab/veltria-service',arcname='service')
    tar.add(repo/'apps/ui/dist',arcname='ui')
with archive.open('rb') as stream: lab('tar','-xf','-','-C',base,stdin=stream)
lab('chmod','700',base+'/service')
proc=None
opener=None
origin=''
csrf=''
def call(path, data=None, method=None):
    headers={'origin':origin,'content-type':'application/json','x-veltria-csrf':csrf}
    if path.startswith('/control/'): headers['x-veltria-control']=control
    request=urllib.request.Request(origin+'/api/v1'+path, data=None if data is None else json.dumps(data).encode(),headers=headers,method=method)
    with opener.open(request,timeout=120) as response:
        result=response.read()
        return json.loads(result) if 'json' in response.headers.get('content-type','') else result
def start():
    global proc,opener,origin,csrf
    log=(repo/'build/lab/service-stderr.log').open('ab')
    proc=subprocess.Popen([wsl,'-d','Veltria-Lab','-u','veltria','--exec',base+'/service','--data-dir',base+'/data','--ui-dir',base+'/ui'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=log)
    proc.stdin.write(json.dumps({'controlToken':control}).encode());proc.stdin.close()
    line=proc.stdout.readline()
    if not line: raise RuntimeError('Lab service did not start; see build/lab/service-stderr.log')
    ready=json.loads(line);origin=ready['origin']
    opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    csrf=call('/session',{'nonce':ready['nonce']})['csrf']
def stop():
    if proc and proc.poll() is None:
        call('/control/shutdown',{})
        proc.wait(timeout=40)
def scan():
    call('/setup/scan',{})
    for _ in range(300):
        s=call('/setup')
        if s['status']=='complete': return s
        time.sleep(.2)
    raise RuntimeError('Scan timeout')
def authorize():
    plan=call('/setup/managed/plan',{})
    (repo/'build/lab/authorized-plan.json').write_text(json.dumps(plan,indent=2))
    if not plan['canPrepare']: raise RuntimeError(plan['blockers'])
    # The reviewed plan authorizes only this recipe and this starter model, within the stated total.
    if plan['recipe']!='comfy-0.35.0-py312-torch271-linux-v1' or plan['remainingBytes']+plan['preparation']['remainingBytes']>6012030833:
        raise RuntimeError('Plan exceeds the authorized scope')
    call('/setup/managed/prepare',{'revision':plan['revision'],'acceptLicense':True,'acceptInstallation':True})
    return plan
report={'result':'running','fixture':False,'dataDir':base+'/data','pauseAndRestart':False,'generated':False}
try:
    start(); jobs_before=call('/jobs')['total']; scan(); plan=authorize()
    print('Authorized real plan:',plan['recipe'],flush=True)
    paused=False; previous=None; deadline=time.time()+7200
    while time.time()<deadline:
        state=call('/setup/managed')
        marker=(state['status'],state['received']//(50*1024**2))
        if marker!=previous:
            print(state['status'],f"{state['received']/1024**2:.1f}/{state['total']/1024**2:.1f} MiB",state['message'][:400],flush=True);previous=marker
        if not paused and state['status']=='downloading' and state['received']>8*1024**2:
            call('/setup/managed/pause',{});stop();start()
            assert call('/setup/managed')['status']=='paused'
            scan();authorize();paused=True;report['pauseAndRestart']=True
        if state['status']=='ready': break
        if state['status']=='error': raise RuntimeError(state['message'])
        time.sleep(2)
    else: raise RuntimeError('Real installation timeout')
    assert call('/jobs')['total']==jobs_before,'Preparation must not generate'
    job=call('/jobs',{'requestId':str(uuid.uuid4()),'prompt':'A small copper teapot on a wooden table, warm window light, realistic photography','format':'square'})
    deadline=time.time()+900
    while time.time()<deadline:
        job=call('/jobs/'+job['id'])
        if job['status']=='completed':break
        if job['status'] in ['failed','interrupted','cancelled']:raise RuntimeError(job['message'])
        time.sleep(2)
    else:raise RuntimeError('Generation timeout')
    png=call('/artifacts/'+job['imageId'])
    assert png[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',png[16:24])==(512,512)
    (repo/'build/lab/first-managed-image.png').write_bytes(png)
    report.update(generated=True,job=job)
    stop();start();assert call('/jobs')['total']==jobs_before+1
    report.update(result='passed',libraryAfterRestart=True)
    print('Real installation and image passed',flush=True)
except Exception as e:
    report.update(result='failed',error=str(e));raise
finally:
    stop()
    (repo/'build/lab/validated-managed.json').write_text(json.dumps(report,indent=2))
