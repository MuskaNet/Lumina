# Security Policy

## Reporting a Vulnerability

Lumina is a fork of [kkRepo](https://github.com/klboke/kkRepo) that changes only the UI layer, not the backend logic.

- For vulnerabilities unrelated to the UI changes, including backend issues inherited from kkRepo, please report privately to [upstream kkRepo](https://github.com/klboke/kkRepo/security/advisories/new) first.
- For vulnerabilities introduced by Lumina's UI changes, please report privately to [Lumina](https://github.com/MuskaNet/Lumina/security/advisories/new).
- If the cause is unclear, report privately to Lumina and mention the uncertainty so the issue can be coordinated with upstream.

Lumina 是 kkRepo 的 fork 改版，仅修改 UI 层逻辑，不改变后端逻辑。与 UI 改动无关的安全问题（包括继承自 kkRepo 的后端问题）请优先向上游 kkRepo 私密报告；由 Lumina UI 改动引入的问题请向 Lumina 私密报告。无法确定来源时，可先向 Lumina 私密报告并注明，以便与上游协调。

Do not disclose exploitable details in public issues, pull requests, or discussions before a fix is available.

When reporting, include:

- Affected kkrepo version or commit.
- Deployment mode and relevant security configuration.
- Steps to reproduce or proof-of-concept details.
- Impact assessment, including whether authentication, authorization, repository content, tokens, credentials, or migration data are affected.
- Logs or HTTP traces with secrets redacted.

## Supported Versions

kkrepo is early-stage open source software. Security fixes target the latest `main` branch unless a release branch is explicitly announced.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Older commits or unannounced branches | No |

## Public Issues

Use public issues for ordinary bugs, compatibility differences, feature requests, and documentation problems. If an issue could enable unauthorized access, credential exposure, token leakage, privilege escalation, repository-content disclosure, or remote code execution, report it privately first.
