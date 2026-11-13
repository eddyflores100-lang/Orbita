# Contributing

Thanks for contributing to ÓRBITA.

## Before changing the pipeline

Review the documented flow for photo ingestion, property understanding, shot planning, generation, rendering, audio and microsite publishing. Preserve the distinction between user-supplied source photos and AI-generated media.

## Pull request expectations

- Keep changes focused and document affected pipeline stages.
- Never commit API keys, customer photos, private property details or generated customer deliverables.
- Validate file type, size and upload boundaries at ingestion.
- Keep provider calls and credentials server-side.
- Test failure paths: provider unavailable, timeout, invalid media, interrupted render and retry.
- Preserve provenance and disclose generated/edited media; do not claim generated scenes prove actual property features.

Include verification commands, manual test steps, sample fixtures that contain no personal data, and known limitations.
