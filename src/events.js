(function initializeCoeurGoEventsModule(global) {
  "use strict";

  function addDomListener(cleanups, target, type, handler, options) {
    if (!target || typeof target.addEventListener !== "function") {
      return;
    }
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  function addMapListener(cleanups, target, type, handler) {
    if (!target || typeof target.on !== "function") {
      return;
    }
    target.on(type, handler);
    cleanups.push(() => {
      if (typeof target.off === "function") {
        target.off(type, handler);
      }
    });
  }

  function addInterval(cleanups, hostWindow, callback, delayMs) {
    if (!hostWindow || typeof hostWindow.setInterval !== "function") {
      return;
    }
    const intervalId = hostWindow.setInterval(callback, delayMs);
    cleanups.push(() => hostWindow.clearInterval(intervalId));
  }

  function createAssistantHandler(actions, intent, label) {
    return function handleAssistantRequest() {
      actions.askAssistant(intent, label);
    };
  }

  function createSetModeHandler(actions, mode) {
    return function handleSetMode() {
      actions.setHeaderMode(mode);
    };
  }

  function createViewRegionHandler(actions) {
    return function handleViewRegion() {
      actions.fitToFrance();
      actions.showStatus("Vue Vernon recentree.", "info");
    };
  }

  function createChecklistChangeHandler(context, index) {
    return function handleChecklistChange(event) {
      const input = event.currentTarget;
      const checklistCard = input.closest(".checklist-item");
      const checklistToggle = input.closest(".checklist-check");

      checklistCard?.classList.toggle("is-complete", input.checked);
      checklistToggle?.classList.toggle("is-checked", input.checked);
      context.actions.updateChecklistState();

      if (!input.checked) {
        return;
      }

      const nextItem = context.checklistItems
        .slice(index + 1)
        .find(candidate => !candidate.checked);

      if (!nextItem) {
        return;
      }

      nextItem.closest(".checklist-item")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
      nextItem.focus({ preventScroll: true });
    };
  }

  function createOverlayDismissHandler(overlay, closeOverlay) {
    return function handleOverlayDismiss(event) {
      if (event.target === overlay) {
        closeOverlay();
      }
    };
  }

  function createPhotoInputHandler(actions) {
    return function handlePhotoInputChange(event) {
      const input = event.currentTarget;
      const file = input.files && input.files[0];
      if (file) {
        actions.handlePhotoWithDaeAi(file);
      }
      input.value = "";
    };
  }

  function registerAppEvents(context) {
    const cleanups = [];
    const hostWindow = context.hostWindow || global;
    const { refs, actions, checklistItems, map } = context;

    addInterval(cleanups, hostWindow, actions.updateClock, 1000);
    addInterval(cleanups, hostWindow, actions.maybeTriggerAssistantIdle, 5000);

    addDomListener(cleanups, refs.findBtn, "click", actions.findAED);
    addDomListener(cleanups, refs.checkBtn, "click", actions.checkAED);
    addDomListener(cleanups, refs.addDaeBtn, "click", actions.handleAddDaeAction);
    addDomListener(cleanups, refs.topAddDaeBtn, "click", actions.handleAddDaeAction);
    addDomListener(cleanups, refs.topRemoveDaeBtn, "click", actions.handleRemoveDaeAction);
    addDomListener(cleanups, refs.photoBtn, "click", actions.photoAED);
    addDomListener(cleanups, refs.gpsBtn, "click", actions.locatePlayer);
    addDomListener(cleanups, refs.viewRegionBtn, "click", createViewRegionHandler(actions));
    addDomListener(cleanups, refs.desktopViewBtn, "click", createSetModeHandler(actions, "desktop"));
    addDomListener(cleanups, refs.mobileViewBtn, "click", createSetModeHandler(actions, "mobile"));
    addDomListener(cleanups, refs.assistantNextBtn, "click", createAssistantHandler(actions, "next", "Etape suivante"));
    addDomListener(cleanups, refs.assistantExplainBtn, "click", createAssistantHandler(actions, "explain", "Explique-moi cette action"));
    addDomListener(cleanups, refs.assistantBlockedBtn, "click", createAssistantHandler(actions, "blocked", "Je suis bloque"));
    addDomListener(cleanups, refs.openTrophyCatalogBtn, "click", actions.openTrophyCatalog);
    addDomListener(cleanups, refs.playerTrophyBadge, "click", actions.openTrophyCatalog);
    addDomListener(cleanups, refs.levelReward, "click", actions.openTrophyCatalog);
    addDomListener(cleanups, refs.closeChecklistBtn, "click", actions.closeChecklist);
    addDomListener(cleanups, refs.validateChecklistBtn, "click", actions.validateChecklist);
    addDomListener(cleanups, refs.closeTrophyCatalogBtn, "click", actions.closeTrophyCatalog);
    addDomListener(
      cleanups,
      refs.checklistOverlay,
      "click",
      createOverlayDismissHandler(refs.checklistOverlay, actions.closeChecklist)
    );
    addDomListener(
      cleanups,
      refs.trophyCatalogOverlay,
      "click",
      createOverlayDismissHandler(refs.trophyCatalogOverlay, actions.closeTrophyCatalog)
    );
    addDomListener(cleanups, refs.photoInput, "change", createPhotoInputHandler(actions));

    checklistItems.forEach((item, index) => {
      addDomListener(cleanups, item, "change", createChecklistChangeHandler(context, index));
    });

    addMapListener(cleanups, map, "moveend zoomend", actions.queueVisibleMarkersRefresh);
    addMapListener(cleanups, map, "click", actions.handleMapClick);

    addDomListener(cleanups, hostWindow, "pointerdown", actions.noteAssistantInteraction, true);
    addDomListener(cleanups, hostWindow, "keydown", actions.noteAssistantInteraction, true);
    addDomListener(cleanups, hostWindow, "resize", actions.updateLayoutMetrics);
    addDomListener(cleanups, hostWindow, "load", actions.updateLayoutMetrics);

    return {
      destroy() {
        cleanups.slice().reverse().forEach(cleanup => cleanup());
      }
    };
  }

  global.CoeurGoEvents = Object.freeze({
    registerAppEvents
  });
})(window);
