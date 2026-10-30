# Security policy

Connectome is a local visualization plugin: it scans the current workspace on the
Host, serves the result over a same-origin HTTP route fenced by
`ctx.connection.requestRejection`, and renders it in the browser. It sends no
workspace data or telemetry to any third-party service.

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | Yes |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem. Use GitHub's private
vulnerability reporting on this repository (**Security → Advisories → Report a
vulnerability**) or email the maintainer listed in `package.json`. You should get a
response within a few days.

Useful details: the affected version, the DSH version, the workspace shape, and the
steps needed to reproduce the issue.

## Scope notes

- The scanner only reads text/source files under the selected workspace root, skips
  symlinks, `node_modules`, `.git`, build outputs and dot-directories, and applies
  file/duration/entry caps.
- File opening uses the harness' own right-Sidebar document preview and the
  authenticated `dsh-resource://file/session/…` address; Connectome itself never
  reads a file into its own UI or stores file contents.
- The generated browser bundle inlines d3 under its ISC license; see
  `vendor/LICENSE-d3.txt`.
