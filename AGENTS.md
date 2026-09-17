# Project guidance

## Project scope

This project primarily targets desktop and mobile web browsers.

Treat the web experience as the primary product surface. When a feature may
behave differently on smaller screens, document whether mobile web is
supported, intentionally limited, or deferred.

## Related repositories

This frontend repository is maintained under the
[`sugkamoney`](https://github.com/sugkamoney) GitHub organization.

The corresponding backend service is maintained in
[`sugkamoney/geupjido-backend`](https://github.com/sugkamoney/geupjido-backend).

When investigating API behavior, request and response schemas, authentication,
or frontend-backend integration issues, consult the backend repository when
access is available. Do not modify the backend repository unless the task
explicitly includes backend changes.

## Documentation

Keep project documentation current as part of the work.

When a session produces or changes meaningful product behavior, frontend
architecture, technical learning, or implementation rationale, update the
appropriate document under `docs/` before considering the task complete.

Use:

- `docs/product/` for current user-facing behavior, UX rules, responsive
  behavior, and browser-support policies
- `docs/architecture/` for frontend structure, component boundaries, routing,
  state and data flow, API integration, styling, testing, build, and deployment
  design
- `docs/learning/` for frontend concepts and technologies explained in the
  context of this project
- `docs/history/` for meaningful product or technical decisions, alternatives,
  trade-offs, and implementation rationale

Do not create history records for formatting, renaming, obvious typo fixes, or
other trivial mechanical changes.

When a non-trivial frontend or web-development question is answered, preserve
the question and a concise answer under
`docs/learning/frontend/q-and-a/`.

A learning record should explain both the general concept and how it applies to
this project. Do not record generic reference material that has no meaningful
connection to the project.

Product-planning and UX-policy questions are not learning Q&A records. Capture
the resulting current behavior in `docs/product/` and preserve meaningful
decision rationale in `docs/history/`.

Keep concise `INDEX.md` files current for document category folders, and create
or update an index when a folder gains multiple documents or subtopics.

Do not place secrets, access tokens, private user data, or sensitive deployment
information in project documentation.

## Commit convention

Use the following commit message format:

```text
[#issue-number] category: 한글 설명

간단한 작업 내용
```

- Use the GitHub issue number in `[#issue-number]` when one exists. Omit the
  brackets entirely when there is no issue number.
- Use one of these categories:
  - `docs` for documentation
  - `feature(web)` for frontend feature development
  - `bugfix` for bug fixes
- Write the description in Korean.
- Keep the first line to a short summary.
- Add a blank line after the summary, followed by a concise description of the
  work. Do not make the body unnecessarily long.
