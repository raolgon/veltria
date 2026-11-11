"""Opt-in process-tree crash, confined to the named hito-3 acceptance service."""
import argparse,json,pathlib,sqlite3,os,signal,time
parser=argparse.ArgumentParser()
parser.add_argument('--phase',choices=['extraction','dependencies'],required=True)
args=parser.parse_args()
base=pathlib.Path('/home/veltria/lab/acceptance-hito3-20261110')
descriptor=base/'data/.service-lock/instance.json'
needle='Preparando los archivos' if args.phase=='extraction' else 'Instalando los componentes'
deadline=time.time()+600
while time.time()<deadline:
    databases=list((base/'data').glob('*.sqlite'))+list((base/'data').glob('*.db'))
    if databases:
        try:
            with sqlite3.connect(str(databases[0])) as db:
                row=db.execute('SELECT data FROM managed_setup WHERE id=1').fetchone()
            state=json.loads(row[0]) if row else {}
        except sqlite3.Error:
            state={}
        if state.get('status')=='installing' and needle in state.get('message',''):
            data=json.loads(descriptor.read_text());pid=data['pid']
            command=pathlib.Path('/proc')/str(pid)/'cmdline'
            if str(base/'app/resources/service/veltria-service').encode() not in command.read_bytes():
                raise RuntimeError('Refusing to crash an unexpected service')
            # Include only descendants of this exact service; never touch other apps.
            descendants=[pid]
            for parent in descendants:
                for proc in pathlib.Path('/proc').iterdir():
                    if not proc.name.isdigit() or int(proc.name) in descendants: continue
                    try:
                        stat=(proc/'stat').read_text().rsplit(')',1)[1].split()
                        if int(stat[1])==parent: descendants.append(int(proc.name))
                    except (FileNotFoundError,ProcessLookupError,PermissionError): pass
            for target in reversed(descendants):
                try: os.kill(target,signal.SIGKILL)
                except ProcessLookupError: pass
            record={'phase':args.phase,'lastState':state,'killed':descendants,'at':time.time()}
            (base/('crash-'+args.phase+'.json')).write_text(json.dumps(record,indent=2))
            print(json.dumps(record),flush=True)
            break
    time.sleep(.1)
else: raise RuntimeError('Requested installation phase was not reached')
