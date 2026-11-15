{{- define "librus-forwarder.fullname" -}}
{{- .Release.Name -}}
{{- end -}}

{{/* Immutable: used in selectors. Changing these breaks upgrades of an existing Deployment. */}}
{{- define "librus-forwarder.selectorLabels" -}}
app.kubernetes.io/name: librus-forwarder
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "librus-forwarder.labels" -}}
{{ include "librus-forwarder.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}
