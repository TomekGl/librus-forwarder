{{- define "librus-forwarder.fullname" -}}
{{- .Release.Name -}}
{{- end -}}

{{- define "librus-forwarder.labels" -}}
app.kubernetes.io/name: librus-forwarder
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
