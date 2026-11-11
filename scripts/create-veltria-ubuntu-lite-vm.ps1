$ErrorActionPreference = 'Stop'
$vbox = 'C:\Program Files\Oracle\VirtualBox\VBoxManage.exe'
$name = 'Veltria-Ubuntu-Lite'
$base = 'D:\Veltria\vm'
$vmDir = Join-Path $base $name
$disk = Join-Path $vmDir "$name.vdi"
$exists = & $vbox list vms | Select-String ('^"' + [regex]::Escape($name) + '"')
if ($exists) { throw "VM already exists: $name" }
New-Item -ItemType Directory -Path $vmDir -Force | Out-Null
& $vbox createvm --name $name --ostype Ubuntu_64 --basefolder $base --register
& $vbox modifyvm $name --memory 2048 --cpus 2 --graphicscontroller vmsvga --vram 32 --nic1 nat --audio-enabled off --clipboard-mode disabled --draganddrop disabled --boot1 dvd --boot2 disk --boot3 none --boot4 none
& $vbox createmedium disk --filename $disk --format VDI --size 32768 --variant Standard
& $vbox storagectl $name --name 'SATA' --add sata --controller IntelAhci --bootable on
& $vbox storageattach $name --storagectl 'SATA' --port 0 --device 0 --type hdd --medium $disk
& $vbox showvminfo $name --machinereadable | Select-String '^(name|VMState|memory|cpus|CfgFile|SATA-0-0)='
