FROM alpine:3.20
RUN apk add --no-cache openssh-server \
 && adduser -D -s /bin/sh tunnel \
 && passwd -u tunnel \
 && mkdir -p /home/tunnel/.ssh && chown tunnel /home/tunnel/.ssh && chmod 700 /home/tunnel/.ssh
COPY sshd_config /etc/ssh/sshd_config
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
