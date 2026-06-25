# Smith Licensing, Branding, and Distribution Policy

Status: MVP-0 proposed
Date: 25 June 2026

## Policy

Smith may use MIT-licensed Code OSS source as an upstream baseline. Smith must not depend on the Microsoft-distributed VS Code Server, Microsoft VS Code branding, Microsoft update services, or the Microsoft Visual Studio Marketplace unless a later legal review explicitly approves that dependency.

## Required controls

- Build artifacts must record the pinned Code OSS commit.
- Client and remote-agent artifacts must record the same Smith version and Code OSS commit.
- Product metadata must use Smith names and identifiers, not Microsoft Visual Studio Code names or identifiers.
- Distribution packages must include an SBOM, licence notices, artifact hashes, and provenance.
- Extension registry behavior must be configurable and documented before release.
- Telemetry must remain off until a Smith telemetry policy exists.

## Prohibited default dependencies

- Microsoft-packaged VS Code Server.
- Microsoft Visual Studio Code product branding.
- Microsoft update endpoints.
- Microsoft Marketplace as an implicit default extension registry.
- Any closed-source binary required to start the Smith remote agent.

## MVP-0 gate

MVP-0 passes only if the product metadata and generated artifacts show:

- `usesMicrosoftPackagedVSCodeServer: false`;
- `usesMicrosoftVisualStudioCodeBranding: false`;
- `usesMicrosoftMarketplaceByDefault: false`;
- matching upstream commit in client and agent artifacts.

