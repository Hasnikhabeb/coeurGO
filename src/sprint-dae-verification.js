(function initializeSprintDaeVerification(global) {
  "use strict";

  const storeApi = global.CoeurGoStore;
  if (!storeApi || typeof storeApi.setState !== "function" || typeof storeApi.getState !== "function") {
    return;
  }

  const TARGET_CITY_PREFIXES = ["VERNON"];
  const IDF_POSTCODE_PREFIXES = ["75", "77", "78", "91", "92", "93", "94", "95"];

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  }

  function matchesTargetArea(aed) {
    const city = normalize(aed && aed.city);
    const postcode = normalize(aed && aed.postcode).replace(/\D/g, "");

    const isVernon = TARGET_CITY_PREFIXES.some(prefix => city.startsWith(prefix));
    const isIdf = IDF_POSTCODE_PREFIXES.some(prefix => postcode.startsWith(prefix));

    return isVernon || isIdf;
  }

  function filterAeds(list) {
    if (!Array.isArray(list)) {
      return list;
    }
    return list.filter(matchesTargetArea);
  }

 codex/prepare-clean-environment-for-dae-sprint-drms8a
  function filterStorePartial(partial) {
    if (!partial || typeof partial !== "object") {
      return partial;
    }

    const nextPartial = { ...partial };
    if (Array.isArray(nextPartial.aeds)) {
      nextPartial.aeds = filterAeds(nextPartial.aeds);
    }
    if (Array.isArray(nextPartial.nationalPreviewAeds)) {
      nextPartial.nationalPreviewAeds = filterAeds(nextPartial.nationalPreviewAeds);
    }
    return nextPartial;
  }

  let applyCurrentState = partial => storeApi.setState(partial);
  if (typeof storeApi.registerStateFilter === "function") {
    storeApi.registerStateFilter(filterStorePartial);
  } else {
    const originalSetState = storeApi.setState;
    storeApi.setState = function patchedSetState(partial) {
      return originalSetState(filterStorePartial(partial));
    };
    applyCurrentState = partial => originalSetState(filterStorePartial(partial));
  }

  const currentState = storeApi.getState();
  applyCurrentState({
    aeds: currentState.aeds,
    nationalPreviewAeds: currentState.nationalPreviewAeds

  const originalSetState = storeApi.setState;
  storeApi.setState = function patchedSetState(partial) {
    if (partial && typeof partial === "object") {
      if (Array.isArray(partial.aeds)) {
        partial.aeds = filterAeds(partial.aeds);
      }
      if (Array.isArray(partial.nationalPreviewAeds)) {
        partial.nationalPreviewAeds = filterAeds(partial.nationalPreviewAeds);
      }
    }
    return originalSetState(partial);
  };

  const currentState = storeApi.getState();
  originalSetState({
    aeds: filterAeds(currentState.aeds),
    nationalPreviewAeds: filterAeds(currentState.nationalPreviewAeds)
 main
  });

  global.addEventListener("DOMContentLoaded", () => {
    const viewRegionBtn = document.getElementById("viewRegionBtn");
    if (viewRegionBtn) {
      viewRegionBtn.textContent = "Vernon + IDF";
    }

    const missionBox = document.getElementById("missionBox");
    if (missionBox && !missionBox.querySelector(".scope-banner")) {
      const banner = document.createElement("div");
      banner.className = "scope-banner";
      banner.textContent = "Filtre actif : DAE de Vernon et d'Île-de-France uniquement.";
      missionBox.prepend(banner);
    }

    document.body.classList.add("readable-ui");
  });
})(window);
