(() => {
  "use strict";

  const repo = "Hasnikhabeb/coeurGO";
  const branch = "main";
  const versionBaseSha = "7ead51c";
  const versionBaseTenths = 1;
  const githubApi = `https://api.github.com/repos/${repo}`;
  const versionEl = document.querySelector(".logo-version");
  const updateEl = document.getElementById("logoUpdateDate");

  function formatVersion(tenths) {
    const safeTenths = Math.max(versionBaseTenths, Number.isFinite(tenths) ? tenths : versionBaseTenths);
    return `v${Math.floor(safeTenths / 10)}.${safeTenths % 10}`;
  }

  function formatDate(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return "date GitHub indisponible";
    }

    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Paris"
    }).format(date);
  }

  function updateReleaseDisplay({ commitDate, shortHash, version }) {
    if (versionEl) {
      versionEl.textContent = version;
      versionEl.setAttribute("aria-label", `Version ${version}`);
    }
    if (updateEl) {
      updateEl.textContent = `Dernier commit: ${formatDate(commitDate)}${shortHash ? ` (${shortHash})` : ""}`;
    }
  }

  async function fetchJson(path) {
    const response = await fetch(`${githubApi}${path}`, {
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json"
      }
    });
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}`);
    }
    return response.json();
  }

  async function refreshReleaseInfo() {
    const [comparison, latestCommit] = await Promise.all([
      fetchJson(`/compare/${versionBaseSha}...${branch}`),
      fetchJson(`/commits/${branch}`)
    ]);
    const aheadBy = Number(comparison.ahead_by);
    const version = formatVersion(versionBaseTenths + Math.max(0, Number.isFinite(aheadBy) ? aheadBy : 0));
    const commitDate = latestCommit?.commit?.committer?.date || latestCommit?.commit?.author?.date;
    const shortHash = latestCommit?.sha ? latestCommit.sha.slice(0, 7) : "";

    updateReleaseDisplay({ commitDate, shortHash, version });
  }

  refreshReleaseInfo().catch(() => {
    if (updateEl) {
      updateEl.textContent = "Dernier commit: GitHub indisponible";
    }
  });
})();
