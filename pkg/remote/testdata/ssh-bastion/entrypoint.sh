#!/bin/sh
# Test bastion: credentials come from the environment and host keys are new on
# every container, so recreating it changes the server key.
set -e
echo "tunnel:${TUNNEL_PASSWORD}" | chpasswd
echo "${TUNNEL_AUTHORIZED_KEYS}" > /home/tunnel/.ssh/authorized_keys
chown tunnel /home/tunnel/.ssh/authorized_keys
chmod 600 /home/tunnel/.ssh/authorized_keys
ssh-keygen -A >/dev/null
exec /usr/sbin/sshd -D -e
