<p align="center">
  <a href="https://jesa.lk">
    <img src="./public/images/jesa-logo.png" height="128" alt="JESA logo">
  </a>
</p>

# JESA 2026

JESA (J'pura Employability Skills Awards) celebrates undergraduate achievement at
the University of Sri Jayewardenepura. The Career Skills Development Society
organizes the awards, with selected categories also open to other state universities.

This repository contains the public awards website, the 2026 application form,
and the administration interface. Visit [jesa.lk](https://jesa.lk).

## GitHub repositories

- `origin`: [universitysjp/jesa](https://github.com/universitysjp/jesa)
- `copy`: [csds-usj/jesa](https://github.com/csds-usj/jesa)

Set up both remotes in an existing clone with:

```sh
git remote set-url origin https://github.com/universitysjp/jesa
git remote add copy https://github.com/csds-usj/jesa
```

## Development

Use Node 24 and Bun 1.3.10, as recorded in `.nvmrc` and `package.json`.

```sh
git clone https://github.com/universitysjp/jesa
cd jesa
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

Open [localhost:3000](http://localhost:3000). Obtain development credentials from a
maintainer for backend features and keep environment files private. Bun is the
package manager; commit `bun.lock` rather than a second lockfile.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start Next.js with Turbopack |
| `bun run build` | Create and type-check a production build |
| `bun run start` | Serve the production build |
| `bun run lint` / `bun run check` | Run the installed Biome checks |
| `bun run fix <path>` | Apply Biome fixes to selected files |
| `bun run typecheck` | Check TypeScript without emitting files |
| `bun run test:unit` | Run colocated Bun unit tests |
| `bun run knip` | Identify unused files, exports, and packages |
| `bun run test:e2e` | Run Playwright tests using an isolated test backend |

Some browser tests submit applications. See [CONTRIBUTING.md](CONTRIBUTING.md)
before running them or any legacy data command.

## Repository guide

- [CONTRIBUTING.md](CONTRIBUTING.md): setup, checks, dependency updates, and pull requests.
- [DESIGN.md](DESIGN.md): route structure, data boundaries, and visual conventions.
- [AGENTS.md](AGENTS.md): working instructions for coding agents.
- [JESA maintenance skill](.agents/skills/jesa-maintenance/SKILL.md): dependency and dead-code review.

Public routes live in `app/(site)/`, admin pages in `app/(admin)/`, shared UI in
`components/`, and maintained content in `constants/`. The current application and
admin flows use the existing Firebase integration. Legacy registration and lookup
routes still use MongoDB, so Mongoose and its sequence plugin remain required.

The `/register` landing page currently announces registration closure; the 2026
form remains at `/register/2026`. General maintenance preserves that behavior.

## Stack

[Next.js](https://nextjs.org/) and [React](https://react.dev/),
[TypeScript](https://www.typescriptlang.org/),
[Tailwind CSS](https://tailwindcss.com/),
[Radix UI](https://www.radix-ui.com/) / [shadcn/ui](https://ui.shadcn.com/),
[Motion](https://motion.dev/), [Lucide](https://lucide.dev/), and
[Zod](https://zod.dev/). See `package.json` and `bun.lock` for exact versions.

Quality tooling uses [Biome](https://biomejs.dev/), [Knip](https://knip.dev/),
Bun tests, and [Playwright](https://playwright.dev/).

## Credits and license

Created by [Pruthivi Thejan](https://links.pruthivithejan.me) and maintained by
the JESA community. See [LICENSE.md](LICENSE.md).
