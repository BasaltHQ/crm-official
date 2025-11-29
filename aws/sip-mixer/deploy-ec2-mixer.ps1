Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Parameters
$Region = 'us-west-2'
$GroupName = 'sip-mixer-sg'
$KeyName = 'sip-mixer-key'
$InstanceName = 'sip-mixer-ec2-tcp'
$UserDataPath = Join-Path $env:TEMP 'sip-mixer-userdata.sh'

# Cloud-init user-data: install Docker, write Asterisk configs (UDP+TCP), start container
$userData = @'
#!/bin/bash
set -xe
yum update -y
amazon-linux-extras install docker -y || yum install -y docker
systemctl enable docker
systemctl start docker
mkdir -p /opt/sip-mixer/asterisk/etc /opt/sip-mixer/asterisk/var /opt/sip-mixer/asterisk/log
cat << 'EOF' > /opt/sip-mixer/asterisk/etc/pjsip.conf
[global]

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060

[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0:5060

[anonymous]
type=endpoint
context=public
disallow=all
allow=ulaw,alaw,opus
allow_subscribe=no
auth=anonymous-auth

[anonymous-auth]
type=auth
auth_type=anonymous

[anonymous-aor]
type=aor
max_contacts=1

[anonymous-ident]
type=identify
endpoint=anonymous
match=0.0.0.0/0
EOF
cat << 'EOF' > /opt/sip-mixer/asterisk/etc/extensions.conf
[general]
static=yes
writeprotect=no
clearglobalvars=no

[public]
; Conference room 6000
exten => 6000,1,NoOp(Join conference 6000)
 same => n,ConfBridge(6000)
 same => n,Hangup()

; Echo test at 6001
exten => 6001,1,Answer()
 same => n,Playback(demo-echotest)
 same => n,Echo()
 same => n,Hangup()
EOF
cat << 'EOF' > /opt/sip-mixer/asterisk/etc/confbridge.conf
[general]

[default_bridge]

[default_user]

[6000]
type=bridge
max_members=50

[6000_user]
EOF
cat << 'EOF' > /opt/sip-mixer/asterisk/etc/rtp.conf
[general]
rtpstart=10000
rtpend=20000
EOF

docker run -d --name sip-mixer --restart unless-stopped --network host \
 -v /opt/sip-mixer/asterisk/etc:/etc/asterisk \
 -v /opt/sip-mixer/asterisk/var:/var/lib/asterisk \
 -v /opt/sip-mixer/asterisk/log:/var/log/asterisk \
 andrius/asterisk:20
'@

# Write user-data to temp file
Set-Content -Path $UserDataPath -Value $userData -Encoding ASCII

# Discover default VPC
$VpcId = aws ec2 describe-vpcs --region $Region --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text
if (-not $VpcId -or $VpcId -eq 'None') { throw "No default VPC found in region $Region" }

# Create or reuse security group
try {
  $SgId = aws ec2 create-security-group --region $Region --group-name $GroupName --description 'SIP mixer SG' --vpc-id $VpcId --query 'GroupId' --output text
} catch {
  $SgId = aws ec2 describe-security-groups --region $Region --filters Name=group-name,Values=$GroupName --query 'SecurityGroups[0].GroupId' --output text
}
if (-not $SgId -or $SgId -eq 'None') { throw "Failed to get/create security group" }

# Authorize SIP + RTP (UDP 5060, TCP 5060, UDP 10000-20000)
try { aws ec2 authorize-security-group-ingress --region $Region --group-id $SgId --ip-permissions "IpProtocol=udp,FromPort=5060,ToPort=5060,IpRanges=[{CidrIp=0.0.0.0/0}]" } catch {}
try { aws ec2 authorize-security-group-ingress --region $Region --group-id $SgId --ip-permissions "IpProtocol=tcp,FromPort=5060,ToPort=5060,IpRanges=[{CidrIp=0.0.0.0/0}]" } catch {}
try { aws ec2 authorize-security-group-ingress --region $Region --group-id $SgId --ip-permissions "IpProtocol=udp,FromPort=10000,ToPort=20000,IpRanges=[{CidrIp=0.0.0.0/0}]" } catch {}

# Create key pair (skip if exists)
$PemPath = Join-Path $env:USERPROFILE 'sip-mixer-key.pem'
try {
  aws ec2 create-key-pair --region $Region --key-name $KeyName --query 'KeyMaterial' --output text > $PemPath
  icacls $PemPath /inheritance:r /grant:r "$env:USERNAME:R" | Out-Null
} catch {}

# Get latest Amazon Linux 2 AMI via SSM parameter
$AmiId = aws ssm get-parameters --region $Region --names "/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2" --query 'Parameters[0].Value' --output text
if (-not $AmiId -or $AmiId -eq 'None') { throw "Failed to resolve Amazon Linux 2 AMI via SSM" }

# Launch EC2 instance
$InstanceId = aws ec2 run-instances --region $Region --image-id $AmiId --count 1 --instance-type t3.small --key-name $KeyName --security-group-ids $SgId --user-data file://$UserDataPath --query 'Instances[0].InstanceId' --output text
if (-not $InstanceId -or $InstanceId -eq 'None') { throw "Failed to launch EC2 instance" }

# Wait until running and get public IP
aws ec2 wait instance-running --region $Region --instance-ids $InstanceId
$PublicIp = aws ec2 describe-instances --region $Region --instance-ids $InstanceId --query 'Reservations[0].Instances[0].PublicIpAddress' --output text
if (-not $PublicIp -or $PublicIp -eq 'None') { throw "Failed to retrieve instance public IP" }

Write-Host "Mixer public IP (TCP/UDP 5060 enabled): $PublicIp" -ForegroundColor Green
Write-Host "Next: Update Lambda env to CHIME_BRIDGE_ENDPOINT_URI=sip:6001@$PublicIp for echo test, then sip:6000@$PublicIp for conference." -ForegroundColor Yellow
