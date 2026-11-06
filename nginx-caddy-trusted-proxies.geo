# Fail closed by default: no forwarded scheme is trusted.
# Deployment must mount a read-only file here containing only the verified,
# reserved Caddy socket-peer IP(s), each followed by "1;". See docs/trusted-ingress.md.
