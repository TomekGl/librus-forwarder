# librus-forwarder

Prosty Helm chart do wdrożenia librus-forwarder w k8s (Traefik ingress, PVC na `/data`,
limity CPU/pamięci pod low-traffic ruch).

## Przed `helm install`

1. Secret z wrażliwymi danymi — albo `secret.existingSecret: <nazwa>` wskazujący na Secret,
   który sam utworzysz z kluczami `FETCH_SECRET`, `LIBRUS_LOGIN`, `LIBRUS_PASSWORD`,
   `SLACK_WEBHOOK_URL` (opcjonalnie), albo wypełnij `secret.*` we własnym
   `secrets.yaml` (nie commitować) i przekaż przez `-f secrets.yaml`.
2. Certyfikat TLS dla hosta z `ingress.host` musi już istnieć jako Secret w tym namespace
   (np. wystawiony wcześniej przez cert-manager) — podaj jego nazwę w `ingress.tls.secretName`.
3. Traefik CRD-y (`Middleware`, `IngressRoute`) muszą być już zainstalowane w klastrze.

## Instalacja

```bash
helm install librus-forwarder ./charts/librus-forwarder \
  -f secrets.yaml \
  --set ingress.host=librus-forwarder.twojadomena.pl \
  --set ingress.tls.secretName=twoj-cert-secret
```

## Uwagi

- Jeden replika, `strategy: Recreate` — PVC jest `ReadWriteOnce`, więc rolling update
  by się zawiesił czekając na odmontowanie woluminu przez starego poda.
- `nodeSelector: kubernetes.io/arch: amd64`, bo obraz jest budowany tylko pod tę architekturę.
- `image.tag` domyślnie = `Chart.AppVersion` (aktualnie najnowszy wydany release).
