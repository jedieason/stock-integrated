# GitHub Pages and Actions

Repository: `jedieason/stock-integrated`. Pages publishing source: **GitHub Actions**, configured through GitHub's Pages API. Project-base URLs use `./` assets and hash navigation.

`deploy.yml` triggers on main application pushes, manual dispatch and UTC `15 9,12 * * 1-5` (Taipei weekdays 17:15/20:15). It calls reusable CI, then collects official data, validates contracts, commits dated observations using the ephemeral GITHUB_TOKEN, builds static dist, uploads the Pages artifact and deploys. GITHUB_TOKEN data commits do not recursively retrigger push workflows; the same running workflow publishes the collected artifact.

Job permissions: checks read-only; data/build job `contents: write`; deployment only `pages: write`, `id-token: write`. No personal access token or provider secret is embedded. Frontend cannot trigger privileged GitHub operations. Concurrency serializes deployments. Scheduled jobs can be delayed or disabled by GitHub inactivity policies; data timestamps remain authoritative.

If snapshot acquisition fails, prior committed observations are preserved and a visible ingestion-job error is recorded. If schema/core-history contract fails, publication stops. A successfully collected but individually missing optional source is disclosed. No synthetic fallback data.

Local: `npm run dev`. Optional Docker static preview: `docker compose up --build`, then <http://127.0.0.1:5173>. Docker does not run a separate database or continuously update data.

Future LLM credentials must run in a proper authenticated server/worker, not in Pages JavaScript. Actions cannot enforce access control for visitors to a public Pages site.
